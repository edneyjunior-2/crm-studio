'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { assertModulo } from '@/lib/gating'
import { criarDocumentoAssinatura } from '@/lib/zapsign'

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
  zapsign_nivel?: 'avancada' | 'qualificada' | null
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
}): Promise<{ error?: string }> {
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
  // só loga. storage_path fica '' (mesmo comportamento de antes) e o usuário
  // não consegue enviar pra assinatura até gerar de novo.
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
      } else {
        const { error: updErr } = await supabase
          .from('contratos_gerados')
          .update({ storage_path: path })
          .eq('id', contrato.id)
        if (updErr) {
          console.error('[salvarContratoGerado] falha ao gravar storage_path:', updErr.message)
        }
      }
    } catch (err) {
      console.error('[salvarContratoGerado] erro ao processar PDF base64:', err)
    }
  }

  revalidatePath('/contratos')
  return {}
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
 * Envia um contrato já gerado (com PDF no Storage) pra assinatura eletrônica
 * via ZapSign. Fluxo: valida o dono do contrato com o client de sessão (RLS),
 * baixa o PDF do Storage com o client admin, chama a API do ZapSign e grava
 * o resultado (token/link/nível) no registro.
 */
export async function enviarParaAssinatura(
  contratoId: string,
  signatario: { nome: string; email?: string; telefone?: string },
): Promise<{ error?: string; linkAssinatura?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const erroModulo = await assertModulo('contratos')
  if (erroModulo) return { error: erroModulo }

  if (!signatario.nome?.trim()) {
    return { error: 'Informe o nome do signatário.' }
  }

  // 1. Busca o contrato com o client de sessão — RLS garante que só um
  //    contrato da própria empresa é retornado.
  const { data: contrato, error: fetchErr } = await supabase
    .from('contratos_gerados')
    .select('id, parceiro_nome, storage_path')
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

  // 3. Nível de assinatura configurado pra empresa (default 'avancada').
  const { data: empresa } = await supabase
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .maybeSingle()

  const config = (empresa?.config as Record<string, unknown> | null) ?? {}
  const nivel = ((config.contrato_nivel_assinatura as string | undefined) === 'qualificada'
    ? 'qualificada'
    : 'avancada') as 'avancada' | 'qualificada'

  // 4. Chama o ZapSign. Erros (chave ausente, falha da API) viram { error }
  //    tratável como toast pelo caller — criarDocumentoAssinatura já lança
  //    mensagens legíveis, nunca o corpo cru da resposta.
  const nomeArquivo = `Contrato - ${(contrato.parceiro_nome ?? contrato.id).slice(0, 200)}.pdf`
  let resultado: { token: string; linkAssinatura: string }
  try {
    resultado = await criarDocumentoAssinatura({
      pdfBase64,
      nomeArquivo,
      signatarios: [signatario],
      nivel,
    })
  } catch (err) {
    console.error('[enviarParaAssinatura] erro ao criar documento no ZapSign:', err)
    return { error: err instanceof Error ? err.message : 'Não foi possível enviar o documento para assinatura.' }
  }

  // 5. Grava o resultado. Client admin: a RLS de UPDATE já escopa por
  //    empresa, mas a Server Action já validou o dono do contrato acima via
  //    select com o client de sessão — usar admin aqui evita depender de a
  //    policy de UPDATE já estar recarregada no schema cache do PostgREST.
  const { error: updateErr } = await admin
    .from('contratos_gerados')
    .update({
      status:             'enviado',
      zapsign_doc_token:  resultado.token,
      zapsign_nivel:      nivel,
      link_assinatura:    resultado.linkAssinatura,
    })
    .eq('id', contratoId)

  if (updateErr) {
    console.error('[enviarParaAssinatura] erro ao atualizar contrato após envio:', updateErr.message)
    return { error: 'O documento foi enviado ao ZapSign, mas não foi possível atualizar o status no CRM. Atualize a página.' }
  }

  revalidatePath('/contratos')
  return { linkAssinatura: resultado.linkAssinatura }
}
