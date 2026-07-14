'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { assertModulo } from '@/lib/gating'
import { criarDocumentoAssinatura, type ModalidadeAssinatura } from '@/lib/zapsign'

const MODALIDADES_VALIDAS: ModalidadeAssinatura[] = ['simples', 'email', 'sms', 'qualificada']

const BUCKET_CONTRATOS_GERADOS = 'contratos-gerados'

export interface ContratoGerado {
  id: string
  parceiro_nome: string | null
  parceiro_doc: string | null
  tipo: 'PJ' | 'PF'
  dados: unknown
  created_at: string
  storage_path?: string | null
  // Assinatura eletrônica (ZapSign) — colunas novas (migration
  // 20260713120000_contratos_assinatura_zapsign.sql). Todas opcionais/nullable
  // porque a migration pode ainda não estar aplicada no ambiente: nesse caso o
  // select simplesmente não traz essas chaves e o runtime trata como
  // 'rascunho'/null (ver contratos-view.tsx).
  status?: 'rascunho' | 'enviado' | 'assinado' | 'recusado' | null
  zapsign_doc_token?: string | null
  zapsign_nivel?: 'simples' | 'email' | 'sms' | 'qualificada' | null
  link_assinatura?: string | null
  signed_at?: string | null
  signed_storage_path?: string | null
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
    .select('id, parceiro_nome, parceiro_doc, tipo, dados, created_at, storage_path, status, zapsign_doc_token, zapsign_nivel, link_assinatura, signed_at, signed_storage_path')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !data) return []

  return data as ContratoGerado[]
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
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const erroModulo = await assertModulo('contratos')
  if (erroModulo) return { error: erroModulo }

  // 1. Busca o contrato com o client de sessão — RLS garante que só um
  //    contrato da própria empresa é retornado.
  const { data: contrato, error: fetchErr } = await supabase
    .from('contratos_gerados')
    .select('id, parceiro_nome, storage_path, dados')
    .eq('id', contratoId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!contrato) return { error: 'Contrato não encontrado.' }
  if (!contrato.storage_path) {
    return { error: 'Gere o contrato antes de enviar pra assinatura.' }
  }

  const admin = createAdminClient()

  // 2. Baixa o PDF do Storage (client admin) e converte pra base64.
  const { data: pdfBlob, error: downloadErr } = await admin.storage
    .from(BUCKET_CONTRATOS_GERADOS)
    .download(contrato.storage_path)

  if (downloadErr || !pdfBlob) {
    console.error('[enviarParaAssinatura] erro ao baixar PDF do Storage:', downloadErr?.message)
    return { error: 'Não foi possível recuperar o PDF do contrato no Storage.' }
  }

  const pdfBase64 = Buffer.from(await pdfBlob.arrayBuffer()).toString('base64')

  // 3. Modalidade de assinatura configurada pra empresa (default 'simples').
  //    Só modalidades gratuitas + qualificada (paga, deliberada) são aceitas
  //    — ver src/lib/zapsign.ts.
  const { data: empresa } = await supabase
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .maybeSingle()

  const config = (empresa?.config as Record<string, unknown> | null) ?? {}
  const modalidadeConfig = config.contrato_nivel_assinatura as string | undefined
  const modalidade = (MODALIDADES_VALIDAS.includes(modalidadeConfig as ModalidadeAssinatura)
    ? modalidadeConfig
    : 'simples') as ModalidadeAssinatura

  // 4. Monta a lista de signatários: a contraparte (cliente/representante +
  //    responsáveis adicionais, tirados do próprio formulário do contrato) e,
  //    se configurado no admin, quem assina em nome da própria empresa — o
  //    contrato tem linha de assinatura pros dois lados, então os dois lados
  //    precisam receber o link.
  const signatarios = extrairSignatariosDaContraparte(contrato.dados)
  if (signatarios.length === 0) {
    return { error: 'O contrato não tem nenhum signatário preenchido. Edite o contrato e informe ao menos o nome da contraparte.' }
  }

  // O responsável pela assinatura da empresa é OBRIGATÓRIO: o contrato tem
  // linha de assinatura pros dois lados, então enviar sem ele produziria um
  // documento que o ZapSign fecha como "assinado" sem a empresa ter assinado.
  // Admin ou sócio cadastra em Configurações (salvarSignatarioContratos).
  const empresaNome  = (config.contrato_signatario_nome as string | undefined)?.trim()
  const empresaEmail = (config.contrato_signatario_email as string | undefined)?.trim()
  if (!empresaNome || !empresaEmail) {
    return {
      error: 'Cadastre quem assina os contratos pela empresa (Configurações → Assinatura de contratos) antes de enviar para assinatura eletrônica.',
    }
  }
  signatarios.push({ nome: empresaNome, email: empresaEmail })

  const semEmail = signatarios.filter((s) => !s.email).map((s) => s.nome)
  if (semEmail.length > 0) {
    return {
      error: `Sem e-mail para: ${semEmail.join(', ')}. Cada signatário recebe o link no próprio e-mail — edite o contrato e preencha o e-mail de todos.`,
    }
  }

  // 5. Chama o ZapSign. Erros (chave ausente, falha da API, ou dado de
  //    contato faltando pra modalidade escolhida) viram { error } tratável
  //    como toast pelo caller — criarDocumentoAssinatura já lança mensagens
  //    legíveis, nunca o corpo cru da resposta.
  const nomeArquivo = `Contrato - ${(contrato.parceiro_nome ?? contrato.id).slice(0, 200)}.pdf`
  let resultado: { token: string; linkAssinatura: string }
  try {
    resultado = await criarDocumentoAssinatura({
      pdfBase64,
      nomeArquivo,
      signatarios,
      modalidade,
    })
  } catch (err) {
    console.error('[enviarParaAssinatura] erro ao criar documento no ZapSign:', err)
    return { error: err instanceof Error ? err.message : 'Não foi possível enviar o documento para assinatura.' }
  }

  // 6. Grava o resultado. Client admin: a RLS de UPDATE já escopa por
  //    empresa, mas a Server Action já validou o dono do contrato acima via
  //    select com o client de sessão — usar admin aqui evita depender de a
  //    policy de UPDATE já estar recarregada no schema cache do PostgREST.
  const { error: updateErr } = await admin
    .from('contratos_gerados')
    .update({
      status:             'enviado',
      zapsign_doc_token:  resultado.token,
      zapsign_nivel:      modalidade,
      link_assinatura:    resultado.linkAssinatura,
    })
    .eq('id', contratoId)

  if (updateErr) {
    console.error('[enviarParaAssinatura] erro ao atualizar contrato após envio:', updateErr.message)
    return { error: 'O documento foi enviado ao ZapSign, mas não foi possível atualizar o status no CRM. Atualize a página.' }
  }

  revalidatePath('/contratos')
  return {
    linkAssinatura: resultado.linkAssinatura,
    signatarios: signatarios.map((s) => s.nome),
  }
}
