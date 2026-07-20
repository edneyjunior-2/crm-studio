'use server'

import { revalidatePath } from 'next/cache'
import { getAuthFinanceiro, getAuthUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ImpactoExclusaoParceiro {
  negocios: number
  clientes: number
  processos: number
  usuarioVinculado: string | null
}

/**
 * Conta o que fica órfão (parceiro_id -> NULL, via ON DELETE SET NULL) se este
 * cadastro for excluído, e se há um login do portal vinculado — a exclusão não
 * apaga o login, só zera meus_parceiro_ids() pra ele, esvaziando o portal dele
 * em silêncio. Usado no dialog de confirmação antes do delete de verdade.
 */
export async function getImpactoExclusaoParceiro(id: string): Promise<ImpactoExclusaoParceiro> {
  const { supabase } = await getAuthFinanceiro()

  const [negocios, clientes, processos, parceiro] = await Promise.all([
    supabase.from('negocios').select('id', { count: 'exact', head: true }).eq('parceiro_id', id),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('parceiro_id', id),
    supabase.from('processos_juridicos').select('id', { count: 'exact', head: true }).eq('indicador_parceiro_id', id),
    supabase.from('parceiros').select('profile_id, profile:profiles!profile_id(full_name)').eq('id', id).maybeSingle(),
  ])

  const profileEmbed = parceiro.data?.profile as { full_name: string }[] | { full_name: string } | null
  const profile = Array.isArray(profileEmbed) ? (profileEmbed[0] ?? null) : profileEmbed
  return {
    negocios: negocios.count ?? 0,
    clientes: clientes.count ?? 0,
    processos: processos.count ?? 0,
    usuarioVinculado: parceiro.data?.profile_id ? (profile?.full_name ?? null) : null,
  }
}

export async function createParceiro(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()
  const userId = user.id

  const contratoAssinado = formData.get('contrato_assinado') === 'true'

  const comissaoRaw = formData.get('comissao_percentual') as string
  const comissaoPercentual = comissaoRaw !== '' && comissaoRaw !== null ? Number(comissaoRaw) : null

  const { error } = await supabase.from('parceiros').insert({
    nome: formData.get('nome') as string,
    empresa: (formData.get('empresa') as string) || null,
    contato_email: (formData.get('contato_email') as string) || null,
    contato_telefone: (formData.get('contato_telefone') as string) || null,
    contrato_assinado: contratoAssinado,
    data_contrato: contratoAssinado ? ((formData.get('data_contrato') as string) || null) : null,
    observacoes: (formData.get('observacoes') as string) || null,
    comissao_percentual: comissaoPercentual,
    created_by: userId,
    responsavel_id: (formData.get('responsavel_id') as string) || userId,
    profile_id: (formData.get('profile_id') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/parceiros')
  return {}
}

export async function updateParceiro(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const contratoAssinado = formData.get('contrato_assinado') === 'true'
  const comissaoRaw = formData.get('comissao_percentual') as string
  const comissaoPercentual = comissaoRaw !== '' && comissaoRaw !== null ? Number(comissaoRaw) : null

  const { error } = await supabase
    .from('parceiros')
    .update({
      nome: formData.get('nome') as string,
      empresa: (formData.get('empresa') as string) || null,
      contato_email: (formData.get('contato_email') as string) || null,
      contato_telefone: (formData.get('contato_telefone') as string) || null,
      contrato_assinado: contratoAssinado,
      data_contrato: contratoAssinado ? ((formData.get('data_contrato') as string) || null) : null,
      observacoes: (formData.get('observacoes') as string) || null,
      comissao_percentual: comissaoPercentual,
      responsavel_id: (formData.get('responsavel_id') as string) || null,
      profile_id: (formData.get('profile_id') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/parceiros')
  return {}
}

export async function deleteParceiro(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  // Busca o contrato ANTES de apagar a linha (senão o path some do banco).
  const { data: parceiro } = await supabase
    .from('parceiros')
    .select('contrato_url')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('parceiros').delete().eq('id', id)

  if (error) return { error: error.message }

  // Best-effort: remove o arquivo do contrato no Storage (bucket 'contratos').
  // Não bloqueia a exclusão do parceiro se a remoção falhar — o registro já foi
  // apagado; loga e segue, igual ao padrão de uploadContrato/removeContrato.
  if (parceiro?.contrato_url) {
    try {
      const admin = createAdminClient()
      await admin.storage.from('contratos').remove([parceiro.contrato_url])
    } catch (storageError) {
      console.error('Erro ao remover contrato do Storage:', storageError)
    }
  }

  revalidatePath('/parceiros')
  return {}
}

/**
 * Cria ou atualiza um parceiro a partir dos dados preenchidos no gerador de contrato.
 * Dedup por CNPJ (PJ) ou CPF (PF): se já existe, atualiza; senão cria.
 * Não usa getAuthFinanceiro (que redireciona) — retorna erro gracioso para o toast.
 */
export async function salvarParceiroDoContrato(input: {
  mode: 'pf' | 'pj'
  fields: Record<string, string>
}): Promise<{ error?: string; created?: boolean; nome?: string }> {
  const { supabase, user, role } = await getAuthUser()
  if (!['admin', 'socio'].includes(role)) {
    return { error: 'Apenas admin ou sócio podem cadastrar parceiros.' }
  }

  const f = input.fields ?? {}
  const pf = input.mode === 'pf'
  const limpar = (v?: string) => (v && v.trim() ? v.trim() : null)

  const nome = pf ? limpar(f.PF_NOME) : limpar(f.REP_NOME)
  if (!nome) return { error: 'Faltou o nome do parceiro no contrato.' }

  const cnpj = pf ? null : limpar(f.PARCEIRO_CNPJ)
  const cpf = pf ? limpar(f.PF_CPF) : null
  const empresa = pf ? null : limpar(f.PARCEIRO_RAZAO)
  const endereco = pf ? limpar(f.PF_ENDERECO) : limpar(f.PARCEIRO_ENDERECO)
  const email = pf ? limpar(f.PF_EMAIL) : limpar(f.REP_EMAIL)
  const comissaoRaw = limpar(f.COMISSAO_PCT)
  const comissao = comissaoRaw ? Number(comissaoRaw) : null

  const observacoes = (pf
    ? [
        f.PF_PROFISSAO && `Profissão: ${f.PF_PROFISSAO}`,
        f.PF_ESTADO_CIVIL && `Estado civil: ${f.PF_ESTADO_CIVIL}`,
        f.PF_RG && `RG: ${f.PF_RG}`,
        f.PF_NACIONALIDADE && `Nacionalidade: ${f.PF_NACIONALIDADE}`,
      ]
    : [
        f.REP_CARGO && `Representante: ${f.REP_NOME} (${f.REP_CARGO})`,
        f.REP_CPF && `CPF do rep.: ${f.REP_CPF}`,
      ]
  ).filter(Boolean).join(' · ') || null

  const dados = {
    nome,
    empresa,
    cnpj,
    cpf,
    endereco,
    tipo_pessoa: input.mode,
    contato_email: email,
    comissao_percentual: comissao,
    observacoes,
    responsavel_id: user.id,
  }

  // Deduplicação por documento
  let existenteId: string | null = null
  if (cnpj) {
    const { data, error } = await supabase.from('parceiros').select('id').eq('cnpj', cnpj).limit(1).maybeSingle()
    if (error) return { error: error.message }
    existenteId = data?.id ?? null
  } else if (cpf) {
    const { data, error } = await supabase.from('parceiros').select('id').eq('cpf', cpf).limit(1).maybeSingle()
    if (error) return { error: error.message }
    existenteId = data?.id ?? null
  }

  if (existenteId) {
    const { error } = await supabase.from('parceiros').update(dados).eq('id', existenteId)
    if (error) return { error: error.message }
    revalidatePath('/parceiros')
    return { created: false, nome }
  }

  const { error } = await supabase.from('parceiros').insert({ ...dados, created_by: user.id })
  if (error) return { error: error.message }
  revalidatePath('/parceiros')
  return { created: true, nome }
}
