'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { assertModulo } from '@/lib/gating'
import {
  dispararAssinaturaZapSign,
  extrairSignatariosDoUpload,
  BUCKET_CONTRATOS_GERADOS,
} from '@/lib/contratos-assinatura'
import { ADDON_ASSINATURA } from '@/lib/addons'
import { temAddon } from '@/lib/addons-server'

export interface ContratoGerado {
  id: string
  parceiro_nome: string | null
  parceiro_doc: string | null
  /** null para uploads (origem='upload') — só o gerador tem PJ/PF. */
  tipo: 'PJ' | 'PF' | null
  dados: unknown
  created_at: string
  storage_path?: string | null
  // Assinatura eletrônica (ZapSign) — colunas novas (migration
  // 20260713120000_contratos_assinatura_zapsign.sql). Opcionais/nullable pro
  // TypeScript refletir que o valor pode ser null em runtime (contrato ainda
  // sem envio, etc.) — o runtime trata ausência como 'rascunho'/null (ver
  // contratos-view.tsx). ATENÇÃO: isso NÃO cobre a migration não ter rodado
  // ainda — pedir uma coluna que não existe no banco faz o PostgREST devolver
  // erro 400 (não uma omissão silenciosa da chave), e listarContratosGerados
  // trata QUALQUER erro devolvendo `[]` — ou seja, uma coluna nova no SELECT
  // sem a migration aplicada esconde o Histórico inteiro, não só o campo
  // novo. Sempre aplicar a migration antes de (ou junto com) publicar uma
  // mudança que adiciona coluna aqui.
  status?: 'rascunho' | 'enviado' | 'assinado' | 'recusado' | null
  zapsign_doc_token?: string | null
  zapsign_nivel?: 'simples' | 'email' | 'sms' | 'qualificada' | null
  link_assinatura?: string | null
  signed_at?: string | null
  signed_storage_path?: string | null
  /** 'gerador' (formulário + template) ou 'upload' (PDF pronto enviado). */
  origem?: 'gerador' | 'upload' | null
  /** Status individual de cada signatário — nome/e-mail confirmados pelo
   *  ZapSign + status ("new"|"link-opened"|"signed"), sincronizado a cada
   *  evento do webhook. Alimenta o painel "quem assinou/quem falta". */
  signatarios_zapsign?: Array<{ nome: string; email?: string; status: string; signedAt?: string | null }> | null
  /** Quem clicou em "Enviar para assinatura" (distinto de created_by, que é quem GEROU o PDF). */
  enviado_por?: string | null
  /** Nome de quem enviou, via embed profiles!enviado_por(full_name) em listarContratosGerados. */
  enviado_por_nome?: string | null
}

export async function salvarContratoGerado(input: {
  parceiro_nome: string | null
  parceiro_doc: string | null
  tipo: 'PJ' | 'PF'
  dados: unknown
  /** Base64 puro (sem prefixo data:...) do PDF gerado no iframe — opcional
   *  porque o engine.js antigo (sem essa mudança) ainda não manda o campo. */
  pdfBase64?: string
  pdfFileName?: string
}): Promise<{ error?: string; avisoUpload?: string; id?: string }> {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const erroModulo = await assertModulo('contratos')
  if (erroModulo) return { error: erroModulo }

  const { data: contrato, error } = await supabase
    .from('contratos_gerados')
    .insert({
      empresa_id:    empresaId,
      parceiro_nome: input.parceiro_nome,
      parceiro_doc:  input.parceiro_doc,
      tipo:          input.tipo,
      dados:         input.dados,
      storage_path:  '',
      created_by:    user.id,
    })
    .select('id')
    .single()

  if (error || !contrato) return { error: error?.message ?? 'Falha ao salvar contrato.' }

  // Upload do PDF pro Storage — best-effort. O registro do contrato já foi
  // salvo acima; se o upload falhar (hiccup transitório de Storage), não
  // derruba o fluxo inteiro (o parceiro e os dados já foram persistidos) —
  // só loga e devolve um aviso pro caller sinalizar (em vez de deixar o
  // usuário descobrir só depois, ao tentar "Enviar para assinatura").
  // storage_path fica '' (mesmo comportamento de antes) até gerar de novo.
  let avisoUpload: string | undefined
  if (input.pdfBase64) {
    try {
      const buffer = Buffer.from(input.pdfBase64, 'base64')
      const path = `${empresaId}/${contrato.id}.pdf`
      const admin = createAdminClient()
      const { error: upErr } = await admin.storage
        .from(BUCKET_CONTRATOS_GERADOS)
        .upload(path, buffer, { contentType: 'application/pdf', upsert: true })

      if (upErr) {
        console.error('[salvarContratoGerado] falha ao subir PDF para o Storage:', upErr.message)
        avisoUpload = 'O contrato foi salvo, mas o PDF não anexou — gere novamente antes de enviar para assinatura.'
      } else {
        const { error: updErr } = await supabase
          .from('contratos_gerados')
          .update({ storage_path: path })
          .eq('id', contrato.id)
        if (updErr) {
          console.error('[salvarContratoGerado] falha ao gravar storage_path:', updErr.message)
          avisoUpload = 'O contrato foi salvo, mas o PDF não anexou — gere novamente antes de enviar para assinatura.'
        }
      }
    } catch (err) {
      console.error('[salvarContratoGerado] erro ao processar PDF base64:', err)
      avisoUpload = 'O contrato foi salvo, mas o PDF não anexou — gere novamente antes de enviar para assinatura.'
    }
  }

  revalidatePath('/contratos')
  return avisoUpload ? { id: contrato.id, avisoUpload } : { id: contrato.id }
}

export async function listarContratosGerados(): Promise<ContratoGerado[]> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return []

  const { data, error } = await supabase
    .from('contratos_gerados')
    .select('id, parceiro_nome, parceiro_doc, tipo, dados, created_at, storage_path, status, zapsign_doc_token, zapsign_nivel, link_assinatura, signed_at, signed_storage_path, origem, signatarios_zapsign, enviado_por, profiles!enviado_por(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !data) return []

  return (data as unknown as Array<ContratoGerado & { 'profiles!enviado_por': unknown }>).map((row) => {
    const enviadoPorRaw = row['profiles!enviado_por'] as { full_name?: string | null } | null
    const contrato: Record<string, unknown> = { ...row }
    delete contrato['profiles!enviado_por']
    return {
      ...(contrato as unknown as ContratoGerado),
      enviado_por_nome: enviadoPorRaw?.full_name ?? null,
    }
  })
}

/**
 * Gera uma URL assinada (60s) para baixar a via assinada do contrato (PDF
 * final que o ZapSign gravou em signed_storage_path após todos assinarem).
 * O bucket é privado — signed_storage_path vem do BANCO (RLS isola por
 * tenant via a query em contratos_gerados), nunca de parâmetro do cliente.
 */
export async function baixarViaAssinada(id: string): Promise<{ url?: string; error?: string }> {
  const { supabase } = await getAuthUser()

  const { data: contrato, error } = await supabase
    .from('contratos_gerados')
    .select('signed_storage_path')
    .eq('id', id)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!contrato?.signed_storage_path) {
    return { error: 'A via assinada ainda não está disponível para este contrato.' }
  }

  const admin = createAdminClient()
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET_CONTRATOS_GERADOS)
    .createSignedUrl(contrato.signed_storage_path, 60)

  if (signErr) return { error: signErr.message }
  return { url: signed?.signedUrl }
}

export async function excluirContratoGerado(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()

  const { error } = await supabase
    .from('contratos_gerados')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/contratos')
  return {}
}

/**
 * Extrai TODOS os signatários da contraparte a partir dos campos do contrato
 * (`contratos_gerados.dados`, o `{ mode, fields, disabled }` que o gerador
 * manda): no modo PF é o próprio cliente; no PJ é o representante legal + cada
 * responsável adicional (REP2_*, REP3_*, ... — ver "+ Adicionar responsável"
 * em public/contratos/engine.js). É o formulário do contrato a fonte da
 * verdade de quem assina — não um campo digitado à parte, que poderia
 * contradizer as linhas de assinatura impressas no PDF.
 *
 * `disabled` é a lista de campos que o usuário DESATIVOU no gerador (botão ×).
 * Campo desativado não sai no PDF, logo quem foi desativado NÃO é signatário —
 * mandar link de assinatura pra alguém que não consta no documento seria grave.
 * Contratos antigos (salvos antes de o gerador mandar `disabled`) simplesmente
 * não têm a chave: aí a lista vem vazia e nada é filtrado, que é o
 * comportamento correto pra eles (não havia como desativar sem isso refletir).
 */
function extrairSignatariosDaContraparte(dados: unknown): Array<{ nome: string; email?: string }> {
  const d = dados as { mode?: string; fields?: Record<string, string>; disabled?: string[] } | null
  const fields = d?.fields
  if (!fields) return []

  const desativados = new Set(d?.disabled ?? [])
  // Valor "como sai no PDF": campo desativado conta como vazio.
  const valor = (campo: string) => (desativados.has(campo) ? '' : fields[campo]?.trim() || '')

  if (d?.mode === 'pf') {
    const nome = valor('PF_NOME')
    return nome ? [{ nome, email: valor('PF_EMAIL') || undefined }] : []
  }

  const signatarios: Array<{ nome: string; email?: string }> = []
  const principal = valor('REP_NOME')
  if (principal) signatarios.push({ nome: principal, email: valor('REP_EMAIL') || undefined })

  // Responsáveis adicionais, na ordem do índice (REP2_, REP3_, ...)
  const indices = new Set<number>()
  for (const chave of Object.keys(fields)) {
    const m = /^REP(\d+)_NOME$/.exec(chave)
    if (m) indices.add(Number(m[1]))
  }
  for (const i of [...indices].sort((a, b) => a - b)) {
    const nome = valor(`REP${i}_NOME`)
    if (nome) signatarios.push({ nome, email: valor(`REP${i}_EMAIL`) || undefined })
  }

  return signatarios
}

/**
 * Envia um contrato já gerado (com PDF no Storage) pra assinatura eletrônica
 * via ZapSign. Fluxo: valida o dono do contrato com o client de sessão (RLS),
 * baixa o PDF do Storage com o client admin, monta a lista de signatários
 * (contraparte + signatário da própria empresa, configurado no admin), chama
 * a API do ZapSign e grava o resultado (token/link/modalidade) no registro.
 *
 * Cada signatário recebe o SEU link individual por e-mail (ver
 * `send_automatic_email` em src/lib/zapsign.ts) — inclusive quem assina pela
 * empresa. Todos assinam em paralelo, sem ordem imposta.
 */
export async function enviarParaAssinatura(
  contratoId: string,
): Promise<{ error?: string; linkAssinatura?: string; signatarios?: string[] }> {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const erroModulo = await assertModulo('contratos')
  if (erroModulo) return { error: erroModulo }

  const admin = createAdminClient()

  // Gate do add-on de assinatura eletrônica (R$49/mês — spec
  // addon-assinatura-eletronica-zapsign.md), logo após o assertModulo e antes
  // de qualquer leitura/mutação do contrato (inclusive contratos de origem
  // 'upload' — o add-on gateia a FUNCIONALIDADE de assinar, não uma origem
  // específica). temAddon é fail-closed (nunca libera às cegas se a checagem
  // falhar).
  if (!(await temAddon(admin, empresaId, ADDON_ASSINATURA))) {
    return {
      error: 'A assinatura eletrônica é um módulo adicional (R$ 49/mês). Peça ao administrador ou sócio da conta para ativar em Configurações.',
    }
  }

  // 1. Busca o contrato com o client de sessão — RLS garante que só um
  //    contrato da própria empresa é retornado.
  const { data: contrato, error: fetchErr } = await supabase
    .from('contratos_gerados')
    .select('id, parceiro_nome, storage_path, dados, origem')
    .eq('id', contratoId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!contrato) return { error: 'Contrato não encontrado.' }
  if (!contrato.storage_path) {
    return { error: 'Gere o contrato antes de enviar pra assinatura.' }
  }

  // 2. Baixa o PDF do Storage (client admin) e converte pra base64.
  const { data: pdfBlob, error: downloadErr } = await admin.storage
    .from(BUCKET_CONTRATOS_GERADOS)
    .download(contrato.storage_path)

  if (downloadErr || !pdfBlob) {
    console.error('[enviarParaAssinatura] erro ao baixar PDF do Storage:', downloadErr?.message)
    return { error: 'Não foi possível recuperar o PDF do contrato no Storage.' }
  }

  const pdfBase64 = Buffer.from(await pdfBlob.arrayBuffer()).toString('base64')

  // 3. Monta a lista de signatários conforme a origem do contrato.
  let signatarios: Array<{ nome: string; email?: string }>
  if (contrato.origem === 'upload') {
    // Upload de PDF pronto: a lista foi informada no envio (dados.signatarios).
    // Não há signatário-empresa automático — o usuário monta a lista inteira.
    signatarios = extrairSignatariosDoUpload(contrato.dados)
    if (signatarios.length === 0) {
      return { error: 'Este documento não tem signatários registrados.' }
    }
  } else {
    // Gerador: contraparte (do formulário) + quem assina pela empresa.
    signatarios = extrairSignatariosDaContraparte(contrato.dados)
    if (signatarios.length === 0) {
      return { error: 'O contrato não tem nenhum signatário preenchido. Edite o contrato e informe ao menos o nome da contraparte.' }
    }
    // O responsável pela assinatura da empresa é OBRIGATÓRIO no gerador: o
    // contrato tem linha de assinatura pros dois lados, então enviar sem ele
    // produziria um documento que o ZapSign fecha como "assinado" sem a empresa
    // ter assinado. Admin/sócio cadastra em Contratos (salvarSignatarioContratos).
    const { data: empresa } = await supabase
      .from('empresas')
      .select('config')
      .eq('id', empresaId)
      .maybeSingle()
    const config = (empresa?.config as Record<string, unknown> | null) ?? {}
    const empresaNome  = (config.contrato_signatario_nome as string | undefined)?.trim()
    const empresaEmail = (config.contrato_signatario_email as string | undefined)?.trim()
    if (!empresaNome || !empresaEmail) {
      return {
        error: 'Cadastre quem assina os contratos pela empresa (aba Contratos → "Quem assina pela empresa") antes de enviar para assinatura eletrônica.',
      }
    }
    signatarios.push({ nome: empresaNome, email: empresaEmail })
  }

  const semEmail = signatarios.filter((s) => !s.email).map((s) => s.nome)
  if (semEmail.length > 0) {
    return {
      error: `Sem e-mail para: ${semEmail.join(', ')}. Cada signatário recebe o link no próprio e-mail — edite o contrato e preencha o e-mail de todos.`,
    }
  }

  // 4. Modalidade + ZapSign + gravação de status (compartilhado com o upload).
  const nomeArquivo = `Contrato - ${(contrato.parceiro_nome ?? contrato.id).slice(0, 200)}.pdf`
  const res = await dispararAssinaturaZapSign({
    empresaId,
    contratoId,
    pdfBase64,
    nomeArquivo,
    signatarios,
    enviadoPor: user.id,
    origem: contrato.origem === 'upload' ? 'upload' : 'gerador',
  })
  if (res.error) return { error: res.error }

  revalidatePath('/contratos')
  return { linkAssinatura: res.linkAssinatura, signatarios: res.signatarios }
}

/**
 * Lê os signatários de um contrato de ORIGEM 'upload' (`dados.signatarios`,
 * array plano) devolvendo a CHAVE (índice string) de cada um, pra permitir
 * editar o e-mail e escrever de volta na posição certa depois.
 */
function mapearSignatariosEditaveisUpload(dados: unknown): Array<{ chave: string; nome: string; email: string }> {
  const d = dados as { signatarios?: Array<{ nome?: string; email?: string }> } | null
  if (!Array.isArray(d?.signatarios)) return []
  return d.signatarios.map((s, i) => ({
    chave: String(i),
    nome:  (s?.nome ?? '').trim(),
    email: (s?.email ?? '').trim(),
  }))
}

// Espelha a travessia de extrairSignatariosDaContraparte, mas devolve a CHAVE do
// campo (pra escrever de volta depois) em vez de só nome/email. Repetida de
// propósito — ver nota acima sobre não tocar na função original.
function mapearSignatariosEditaveisContraparte(dados: unknown): Array<{ chave: string; nome: string; email: string }> {
  const d = dados as { mode?: string; fields?: Record<string, string> } | null
  const fields = d?.fields
  if (!fields) return []

  if (d?.mode === 'pf') {
    const nome = (fields.PF_NOME ?? '').trim()
    return nome ? [{ chave: 'PF_EMAIL', nome, email: (fields.PF_EMAIL ?? '').trim() }] : []
  }

  const out: Array<{ chave: string; nome: string; email: string }> = []
  const principal = (fields.REP_NOME ?? '').trim()
  if (principal) out.push({ chave: 'REP_EMAIL', nome: principal, email: (fields.REP_EMAIL ?? '').trim() })

  const indices = new Set<number>()
  for (const chave of Object.keys(fields)) {
    const m = /^REP(\d+)_NOME$/.exec(chave)
    if (m) indices.add(Number(m[1]))
  }
  for (const i of [...indices].sort((a, b) => a - b)) {
    const nome = (fields[`REP${i}_NOME`] ?? '').trim()
    if (nome) out.push({ chave: `REP${i}_EMAIL`, nome, email: (fields[`REP${i}_EMAIL`] ?? '').trim() })
  }
  return out
}

/**
 * Lista os signatários de um contrato já gerado (upload ou gerador) no
 * formato editável — cada um com a `chave` do campo/índice de onde o e-mail
 * mora em `dados`, pra `salvarEmailsSignatarios` saber onde escrever de volta.
 */
export async function listarSignatariosParaEdicao(
  contratoId: string,
): Promise<{ error?: string; signatarios?: Array<{ chave: string; nome: string; email: string }> }> {
  const { supabase } = await getAuthUser()

  const { data: contrato, error } = await supabase
    .from('contratos_gerados')
    .select('dados, origem')
    .eq('id', contratoId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!contrato) return { error: 'Contrato não encontrado.' }

  const signatarios = contrato.origem === 'upload'
    ? mapearSignatariosEditaveisUpload(contrato.dados)
    : mapearSignatariosEditaveisContraparte(contrato.dados)

  if (signatarios.length === 0) {
    return { error: 'Este contrato não tem signatários com e-mail editável.' }
  }
  return { signatarios }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CAMPO_EMAIL_CONTRAPARTE_RE = /^(PF_EMAIL|REP\d*_EMAIL)$/

/**
 * Corrige o e-mail de um ou mais signatários de um contrato já gerado
 * (sobrescrevendo `dados`, sem histórico de versão — ver nota "Ponytail" na
 * spec). Não reenvia nada: a próxima chamada a `enviarParaAssinatura` já relê
 * `dados` e usa o e-mail novo.
 */
export async function salvarEmailsSignatarios(
  contratoId: string,
  alteracoes: Array<{ chave: string; email: string }>,
): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()

  if (alteracoes.length === 0) return { error: 'Nada para salvar.' }
  for (const a of alteracoes) {
    if (!EMAIL_RE.test(a.email.trim())) {
      return { error: `E-mail inválido: "${a.email}".` }
    }
  }

  const { data: contrato, error: fetchErr } = await supabase
    .from('contratos_gerados')
    .select('dados, origem')
    .eq('id', contratoId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!contrato) return { error: 'Contrato não encontrado.' }

  let novosDados: Record<string, unknown>

  if (contrato.origem === 'upload') {
    const d = (contrato.dados as { signatarios?: Array<{ nome?: string; email?: string }> } | null) ?? {}
    const signatarios = Array.isArray(d.signatarios) ? [...d.signatarios] : []
    for (const a of alteracoes) {
      const i = Number(a.chave)
      if (!Number.isInteger(i) || i < 0 || i >= signatarios.length) {
        return { error: 'Signatário inválido.' }
      }
      signatarios[i] = { ...signatarios[i], email: a.email.trim() }
    }
    novosDados = { ...d, signatarios }
  } else {
    const d = (contrato.dados as { fields?: Record<string, string> } | null) ?? {}
    const fields: Record<string, string> = { ...(d.fields ?? {}) }
    for (const a of alteracoes) {
      // Defesa: `chave` vem do client. Nunca escrever uma chave arbitrária num
      // jsonb — só aceita exatamente os padrões de campo de e-mail conhecidos.
      if (!CAMPO_EMAIL_CONTRAPARTE_RE.test(a.chave)) {
        return { error: 'Campo de e-mail inválido.' }
      }
      fields[a.chave] = a.email.trim()
    }
    novosDados = { ...d, fields }
  }

  const { error: updateErr } = await supabase
    .from('contratos_gerados')
    .update({ dados: novosDados })
    .eq('id', contratoId)

  if (updateErr) return { error: updateErr.message }

  revalidatePath('/contratos')
  return {}
}
