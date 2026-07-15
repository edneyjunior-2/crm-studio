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
 *
 * CONFIRMADO em 2026-07-15 (WebFetch): o payload TAMBÉM traz `signers[]` — o
 * estado de TODOS os signatários (nome, e-mail, status individual), não só
 * quem assinou naquele evento específico. Existe ainda `signer_who_signed`
 * (singular) apontando quem disparou o evento, mas não precisamos dele: como
 * `signers[]` já vem completo em toda chamada, sincronizamos o array inteiro
 * a cada webhook — idempotente por natureza (sobrescreve com o estado atual,
 * não acumula), então nem replay nem fora de ordem quebra nada. Isso alimenta
 * o painel "quem assinou / quem falta" no histórico.
 */

interface ZapSignWebhookSigner {
  name?: string
  email?: string
  status?: string
  signed_at?: string | null
}

interface ZapSignWebhookPayload {
  event_type?: string
  token?: string
  status?: string
  signed_file?: string
  signers?: ZapSignWebhookSigner[]
}

// Ordem de avanço do status de um signatário — nunca "des-assina" ninguém.
// Necessário porque dois webhooks do mesmo documento (ex.: 2 pessoas
// assinando perto uma da outra) são requisições HTTP independentes, sem
// garantia de ordem de chegada. Sem isto, o evento mais ANTIGO chegando
// DEPOIS do mais recente reverteria o painel pra um estado ultrapassado —
// de forma permanente, já que não existe um evento seguinte que corrija.
const ORDEM_STATUS: Record<string, number> = { new: 0, 'link-opened': 1, signed: 2 }

function mesclarSignatarios(
  atual: Array<{ nome: string; email?: string; status: string; signedAt?: string | null }> | null | undefined,
  recebido: Array<{ nome: string; email?: string; status: string; signedAt?: string | null }>,
) {
  const porEmail = new Map((atual ?? []).map((s) => [s.email ?? s.nome, s]))
  return recebido.map((novo) => {
    const anterior = porEmail.get(novo.email ?? novo.nome)
    const ordemAnterior = anterior ? (ORDEM_STATUS[anterior.status] ?? 0) : -1
    const ordemNova = ORDEM_STATUS[novo.status] ?? 0
    return ordemNova >= ordemAnterior ? novo : anterior!
  })
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

  const { event_type: eventType, token, status, signed_file: signedFileUrl, signers } = body

  if (!token) {
    return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 3. Resolve o contrato pelo token do documento (RLS não se aplica — client
  //    admin, é service role).
  const { data: contrato, error: fetchErr } = await admin
    .from('contratos_gerados')
    .select('id, empresa_id, signed_storage_path, signatarios_zapsign')
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

  // 4. Sincroniza o status de CADA signatário (painel "quem assinou / quem
  //    falta" no histórico) — roda em TODO evento com `signers[]` presente,
  //    mesmo assinatura parcial (status do documento ainda "pending"), não só
  //    quando fecha. MESCLA com o estado já salvo (ver mesclarSignatarios) em
  //    vez de sobrescrever cego — protege contra webhooks fora de ordem.
  if (Array.isArray(signers) && signers.length > 0) {
    const recebido = signers.map((s) => ({
      nome:     s.name ?? '',
      email:    s.email,
      status:   s.status ?? 'new',
      signedAt: s.signed_at ?? null,
    }))
    const signatariosZapsign = mesclarSignatarios(contrato.signatarios_zapsign, recebido)
    const { error: signersErr } = await admin
      .from('contratos_gerados')
      .update({ signatarios_zapsign: signatariosZapsign })
      .eq('id', contrato.id)
    if (signersErr) {
      // Não aborta o processamento do evento por isto — o painel de status é
      // informativo; o fechamento do contrato (abaixo) é o que importa de
      // verdade e não deve ficar refém dessa escrita secundária.
      console.error('[webhook zapsign] erro ao sincronizar signatarios_zapsign:', signersErr.message)
    }
  }

  // 5. Documento COMPLETO (todos assinaram) — status no nível do documento,
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

  // 6. Recusa — aceita tanto pelo evento quanto pelo status (a doc do ZapSign
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

  // 7. doc_created, doc_deleted, email_bounce, ou status intermediário
  //    (ex.: "pending" — assinatura parcial): nenhum deles fecha o documento,
  //    nada a fazer.
  return NextResponse.json({ ok: true })
}
