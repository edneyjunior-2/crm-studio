import { createAdminClient } from '@/lib/supabase/admin'
import { criarDocumentoAssinatura, type ModalidadeAssinatura } from '@/lib/zapsign'

export const MODALIDADES_VALIDAS: ModalidadeAssinatura[] = ['simples', 'email', 'sms', 'qualificada']

export const BUCKET_CONTRATOS_GERADOS = 'contratos-gerados'

/**
 * Núcleo compartilhado do envio para assinatura: lê a modalidade da empresa,
 * cria o documento no ZapSign e grava o resultado (token/link/status) no
 * registro `contratoId`. Usado tanto pelo gerador (enviarParaAssinatura) quanto
 * pelo upload de PDF pronto (/api/contratos/upload-assinatura) — a lista de
 * signatários já vem pronta e montada pelo chamador (as fontes diferem, o
 * disparo é o mesmo).
 *
 * NÃO é `'use server'` de propósito: fica num módulo comum server-side para o
 * route handler e a Server Action importarem a mesma função sem que ela vire
 * uma Server Action serializada.
 *
 * O UPDATE usa client admin e escopa só por `id` — o chamador é responsável por
 * garantir que `contratoId` pertence à empresa (o gerador valida via RLS antes;
 * o upload cria o registro com o empresa_id correto).
 */
export async function dispararAssinaturaZapSign(params: {
  empresaId: string
  contratoId: string
  pdfBase64: string
  nomeArquivo: string
  signatarios: Array<{ nome: string; email?: string }>
}): Promise<{ error?: string; linkAssinatura?: string; signatarios?: string[] }> {
  const admin = createAdminClient()

  const { data: empresa } = await admin
    .from('empresas')
    .select('config')
    .eq('id', params.empresaId)
    .maybeSingle()

  const config = (empresa?.config as Record<string, unknown> | null) ?? {}
  const modalidadeConfig = config.contrato_nivel_assinatura as string | undefined
  const modalidade = (MODALIDADES_VALIDAS.includes(modalidadeConfig as ModalidadeAssinatura)
    ? modalidadeConfig
    : 'simples') as ModalidadeAssinatura

  // Defesa: todo signatário precisa de e-mail (recebe o próprio link). Os
  // chamadores já validam antes, mas repetir aqui evita uma exception crua de
  // mapearSignatario e devolve erro tratável.
  const semEmail = params.signatarios.filter((s) => !s.email).map((s) => s.nome)
  if (semEmail.length > 0) {
    return { error: `Sem e-mail para: ${semEmail.join(', ')}. Cada signatário recebe o link no próprio e-mail.` }
  }

  let resultado: { token: string; linkAssinatura: string }
  try {
    resultado = await criarDocumentoAssinatura({
      pdfBase64: params.pdfBase64,
      nomeArquivo: params.nomeArquivo,
      signatarios: params.signatarios,
      modalidade,
    })
  } catch (err) {
    console.error('[dispararAssinaturaZapSign] erro ao criar documento no ZapSign:', err)
    return { error: err instanceof Error ? err.message : 'Não foi possível enviar o documento para assinatura.' }
  }

  const { error: updateErr } = await admin
    .from('contratos_gerados')
    .update({
      status:             'enviado',
      zapsign_doc_token:  resultado.token,
      zapsign_nivel:      modalidade,
      link_assinatura:    resultado.linkAssinatura,
    })
    .eq('id', params.contratoId)

  if (updateErr) {
    // DÉBITO CONHECIDO (pré-existente): o documento JÁ foi criado no ZapSign e os
    // e-mails JÁ saíram, mas o token não ficou salvo. Se o usuário reenviar (o
    // status continua 'rascunho'), um 2º documento é criado e novos e-mails vão
    // às mesmas pessoas, e o 1º fica órfão (o webhook resolve por token, que não
    // foi gravado). Logamos o token de forma proeminente pra recuperação manual.
    // Correção definitiva exige idempotência via external_id — ver spec.
    console.error(
      `[dispararAssinaturaZapSign] documento CRIADO no ZapSign (token=${resultado.token}) mas UPDATE falhou:`,
      updateErr.message,
    )
    return { error: 'O documento foi enviado ao ZapSign, mas não foi possível atualizar o status no CRM. Atualize a página — NÃO reenvie.' }
  }

  return { linkAssinatura: resultado.linkAssinatura, signatarios: params.signatarios.map((s) => s.nome) }
}

/**
 * Signatários de um contrato ENVIADO POR UPLOAD (origem='upload'): a lista foi
 * informada manualmente no envio e guardada em `dados.signatarios`. Diferente do
 * gerador, que deriva os signatários dos campos do formulário.
 */
export function extrairSignatariosDoUpload(dados: unknown): Array<{ nome: string; email?: string }> {
  const d = dados as { signatarios?: Array<{ nome?: string; email?: string }> } | null
  if (!Array.isArray(d?.signatarios)) return []
  return d.signatarios
    .map((s) => ({ nome: (s?.nome ?? '').trim(), email: (s?.email ?? '').trim() || undefined }))
    .filter((s) => s.nome)
}
