import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual, createHash } from 'crypto'

const BUCKET_CONTRATOS_GERADOS = 'contratos-gerados'

/**
 * Webhook do ZapSign — recebe notificações de mudança de status de documentos
 * de assinatura eletrônica (ver src/lib/zapsign.ts, comentário de topo, pra
 * fontes e decisões).
 *
 * Segurança: o ZapSign não tem HMAC nativo de assinatura de payload — o
 * mecanismo aqui é um token nosso passado via query string
 * (`?token=...`, cadastrado na URL do webhook no painel ZapSign), validado
 * com `crypto.timingSafeEqual` (mesmo padrão de src/app/api/asaas/webhook).
 *
 * Payload (confirmado via WebFetch em docs.zapsign.com.br/webhooks/eventos):
 * campos no NÍVEL DO DOCUMENTO (não aninhados), com `event_type` indicando o
 * evento (doc_created | doc_signed | doc_refused | doc_deleted | email_bounce)
 * e `status` o estado atual do documento ("signed" = todos assinaram,
 * "pending" = assinatura parcial, "recusado" = alguém recusou). `doc_signed`
 * dispara a CADA assinatura individual — só fechamos o contrato quando
 * `status === 'signed'`, não pelo nome do evento.
 */

interface ZapSignWebhookPayload {
  event_type?: string
  token?: string
  status?: string
  signed_file?: string
}

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const ha = createHash('sha256').update(a).digest()
    const hb = createHash('sha256').update(b).digest()
    return timingSafeEqual(ha, hb)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const webhookToken = process.env.ZAPSIGN_WEBHOOK_TOKEN
  if (!webhookToken) {
    console.error('[webhook zapsign] ZAPSIGN_WEBHOOK_TOKEN não configurado')
    return NextResponse.json({ error: 'Configuração interna ausente' }, { status: 500 })
  }

  // 1. Validar token (timing-safe) — vem na query string, não em header,
  //    porque o ZapSign não suporta assinatura de payload nativa (ver
  //    comentário no topo do arquivo e em src/lib/zapsign.ts).
  const receivedToken = request.nextUrl.searchParams.get('token') ?? ''
  if (!timingSafeCompare(receivedToken, webhookToken)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // 2. Parse do body
  let body: ZapSignWebhookPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const { event_type: eventType, token, status, signed_file: signedFileUrl } = body

  if (!token) {
    return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 3. Resolve o contrato pelo token do documento (RLS não se aplica — client
  //    admin, é service role).
  const { data: contrato, error: fetchErr } = await admin
    .from('contratos_gerados')
    .select('id, empresa_id, signed_storage_path')
    .eq('zapsign_doc_token', token)
    .maybeSingle()

  if (fetchErr) {
    console.error('[webhook zapsign] erro ao buscar contrato por zapsign_doc_token:', fetchErr.message)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!contrato) {
    // Não é erro nosso — pode ser doc de sandbox/teste no painel ZapSign,
    // ou um evento de um documento que nunca chegou a ser vinculado aqui.
    console.log(`[webhook zapsign] nenhum contrato para token=${token} (evento=${eventType ?? '?'}, status=${status ?? '?'})`)
    return NextResponse.json({ ok: true })
  }

  // 4. Documento COMPLETO (todos assinaram) — status no nível do documento,
  //    não o nome do evento (doc_signed dispara a cada assinatura individual).
  if (status === 'signed') {
    // Idempotente via UPDATE condicional (trava): só transiciona se ainda não
    // estava 'assinado'. Um replay do mesmo evento vira no-op aqui.
    const { error: updErr } = await admin
      .from('contratos_gerados')
      .update({ status: 'assinado', signed_at: new Date().toISOString() })
      .eq('zapsign_doc_token', token)
      .neq('status', 'assinado')

    if (updErr) {
      console.error('[webhook zapsign] erro ao marcar contrato como assinado:', updErr.message)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    // Sobe o PDF assinado final pro Storage — gate por signed_storage_path
    // (não pelo resultado do UPDATE acima) de propósito: se uma entrega
    // anterior deste mesmo evento já marcou status='assinado' mas falhou no
    // download/upload (ex.: link do signed_file expirado, erro de rede), o
    // UPDATE acima vira no-op só por causa do WHERE status<>'assinado', mas
    // ainda precisamos tentar de novo o upload nesta entrega/replay — daí
    // checar se signed_storage_path já está preenchido, não o efeito do UPDATE.
    if (signedFileUrl && !contrato.signed_storage_path) {
      try {
        const res = await fetch(signedFileUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar signed_file`)
        const buffer = Buffer.from(await res.arrayBuffer())
        const path = `${contrato.empresa_id}/${contrato.id}_assinado.pdf`

        const { error: upErr } = await admin.storage
          .from(BUCKET_CONTRATOS_GERADOS)
          .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
        if (upErr) {
          console.error('[webhook zapsign] erro ao subir PDF assinado pro Storage:', upErr.message)
          return NextResponse.json({ error: 'storage_error' }, { status: 500 })
        }

        const { error: pathErr } = await admin
          .from('contratos_gerados')
          .update({ signed_storage_path: path })
          .eq('id', contrato.id)
        if (pathErr) {
          console.error('[webhook zapsign] erro ao gravar signed_storage_path:', pathErr.message)
          return NextResponse.json({ error: 'db_error' }, { status: 500 })
        }
      } catch (err) {
        console.error('[webhook zapsign] erro ao baixar PDF assinado do ZapSign:', err)
        // 500 pro ZapSign reenviar — o status já está 'assinado' (idempotente),
        // só o upload do arquivo final fica pendente pra próxima tentativa.
        return NextResponse.json({ error: 'fetch_error' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  }

  // 5. Recusa — aceita tanto pelo evento quanto pelo status (a doc do ZapSign
  //    usa status: "recusado" no payload de doc_refused).
  if (eventType === 'doc_refused' || status === 'recusado') {
    const { error: updErr } = await admin
      .from('contratos_gerados')
      .update({ status: 'recusado' })
      .eq('zapsign_doc_token', token)
      .neq('status', 'assinado')
      .neq('status', 'recusado')

    if (updErr) {
      console.error('[webhook zapsign] erro ao marcar contrato como recusado:', updErr.message)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  // 6. doc_created, doc_deleted, email_bounce, ou status intermediário
  //    (ex.: "pending" — assinatura parcial): nenhum deles fecha o documento,
  //    nada a fazer.
  return NextResponse.json({ ok: true })
}
