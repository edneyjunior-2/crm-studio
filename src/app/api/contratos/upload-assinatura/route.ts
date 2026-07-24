export const maxDuration = 60 // upload + base64 + chamada ao ZapSign

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertModulo } from '@/lib/gating'
import { revalidatePath } from 'next/cache'
import {
  dispararAssinaturaZapSign,
  BUCKET_CONTRATOS_GERADOS,
} from '@/lib/contratos-assinatura'
import { ADDON_ASSINATURA } from '@/lib/addons'
import { temAddon } from '@/lib/addons-server'

// 4 MB: Route Handlers rodam como Serverless Function na Vercel, cujo corpo de
// requisição tem teto de plataforma ~4,5 MB (413 cru antes de chegar aqui).
// 4 MB fica sob esse teto com margem pro overhead do multipart. Contratos
// costumam ter poucas centenas de KB — folga de sobra.
const MAX_PDF_BYTES = 4 * 1024 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Envia um PDF pronto (feito fora do gerador) para assinatura eletrônica via
 * ZapSign. Route handler (não Server Action) porque o arquivo pode passar do
 * teto de 1 MB de body das Server Actions. Ver spec
 * .claude/specs/contratos-upload-assinatura.md.
 */
export async function POST(request: NextRequest) {
  const { user, empresaId } = await getAuthUser()
  if (!empresaId) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 400 })
  }
  const erroModulo = await assertModulo('contratos')
  if (erroModulo) {
    return NextResponse.json({ error: erroModulo }, { status: 403 })
  }

  const admin = createAdminClient()

  // Gate do add-on de assinatura eletrônica (R$49/mês — spec
  // addon-assinatura-eletronica-zapsign.md). Esta rota chama
  // dispararAssinaturaZapSign diretamente (upload fora do gerador) — SEM este
  // gate, o paywall de enviarParaAssinatura (contratos/actions.ts) seria
  // contornável só trocando de rota. Checagem antes de ler o multipart/subir
  // o PDF (fail fast — evita gastar upload/Storage numa requisição que vai
  // ser negada de qualquer forma). temAddon é fail-closed.
  if (!(await temAddon(admin, empresaId, ADDON_ASSINATURA))) {
    return NextResponse.json(
      { error: 'A assinatura eletrônica é um módulo adicional (R$ 49/mês). Peça ao administrador ou sócio da conta para ativar em Configurações.' },
      { status: 403 },
    )
  }

  // 1. Lê o multipart.
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
  }

  const file = form.get('pdf')
  const nomeDoc = (form.get('nome') as string | null)?.trim() || ''
  const signatariosRaw = form.get('signatarios') as string | null

  // 2. Valida o arquivo.
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Selecione um arquivo PDF.' }, { status: 400 })
  }
  const ehPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!ehPdf) {
    return NextResponse.json({ error: 'O arquivo precisa ser um PDF.' }, { status: 400 })
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'O PDF deve ter no máximo 4 MB.' }, { status: 400 })
  }

  // 3. Valida os signatários.
  let signatarios: Array<{ nome: string; email: string }>
  try {
    const parsed = JSON.parse(signatariosRaw ?? '[]') as Array<{ nome?: string; email?: string }>
    signatarios = (Array.isArray(parsed) ? parsed : [])
      .map((s) => ({ nome: (s?.nome ?? '').trim(), email: (s?.email ?? '').trim() }))
      .filter((s) => s.nome || s.email)
  } catch {
    return NextResponse.json({ error: 'Lista de signatários inválida.' }, { status: 400 })
  }
  if (signatarios.length === 0) {
    return NextResponse.json({ error: 'Informe ao menos um signatário.' }, { status: 400 })
  }
  const invalidos = signatarios.filter((s) => !s.nome || !EMAIL_RE.test(s.email))
  if (invalidos.length > 0) {
    return NextResponse.json(
      { error: 'Todo signatário precisa de nome e um e-mail válido (cada um recebe o link no próprio e-mail).' },
      { status: 400 },
    )
  }

  const nomeArquivo = (nomeDoc || file.name.replace(/\.pdf$/i, '') || signatarios[0].nome).slice(0, 200)

  // 4. Cria o registro (origem='upload', tipo=null) com storage_path provisório.
  const { data: contrato, error: insErr } = await admin
    .from('contratos_gerados')
    .insert({
      empresa_id:    empresaId,
      parceiro_nome: nomeArquivo,
      parceiro_doc:  null,
      tipo:          null,
      origem:        'upload',
      dados:         { signatarios },
      storage_path:  '',
      created_by:    user.id,
    })
    .select('id')
    .single()

  if (insErr || !contrato) {
    console.error('[upload-assinatura] falha ao criar registro:', insErr?.message)
    return NextResponse.json({ error: 'Não foi possível registrar o documento.' }, { status: 500 })
  }

  // 5. Sobe o PDF. Se falhar, remove o registro (não deixa órfão sem arquivo).
  const path = `${empresaId}/${contrato.id}.pdf`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from(BUCKET_CONTRATOS_GERADOS)
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true })

  if (upErr) {
    console.error('[upload-assinatura] falha ao subir PDF:', upErr.message)
    await admin.from('contratos_gerados').delete().eq('id', contrato.id)
    return NextResponse.json({ error: 'Não foi possível armazenar o PDF. Tente novamente.' }, { status: 500 })
  }
  // O PDF já está no Storage; se gravar o path falhar, o registro ficaria com
  // storage_path='' (reenvio depois erraria "gere o contrato antes"). Desfaz
  // tudo (remove o objeto + o registro) e pede pra tentar de novo.
  const { error: pathErr } = await admin
    .from('contratos_gerados')
    .update({ storage_path: path })
    .eq('id', contrato.id)
  if (pathErr) {
    console.error('[upload-assinatura] falha ao gravar storage_path:', pathErr.message)
    await admin.storage.from(BUCKET_CONTRATOS_GERADOS).remove([path])
    await admin.from('contratos_gerados').delete().eq('id', contrato.id)
    return NextResponse.json({ error: 'Não foi possível registrar o documento. Tente novamente.' }, { status: 500 })
  }

  // 6. Dispara a assinatura (modalidade + ZapSign + grava status). Se der erro,
  //    o registro fica como rascunho e pode ser reenviado pelo histórico
  //    (enviarParaAssinatura monta os signatários de dados.signatarios).
  const pdfBase64 = buffer.toString('base64')
  const res = await dispararAssinaturaZapSign({
    empresaId,
    contratoId: contrato.id,
    pdfBase64,
    nomeArquivo,
    signatarios,
    enviadoPor: user.id,
    origem: 'upload',
  })

  revalidatePath('/contratos')

  if (res.error) {
    return NextResponse.json({ error: res.error }, { status: 502 })
  }
  return NextResponse.json({ linkAssinatura: res.linkAssinatura, signatarios: res.signatarios })
}
