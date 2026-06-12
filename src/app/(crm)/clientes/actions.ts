'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Retorno especial para CNPJ disponível para assumir
export type VerificarCnpjResult =
  | { status: 'disponivel' }
  | { status: 'bloqueado'; responsavel: string; expiracao: string }
  | { status: 'livre_para_assumir'; clienteId: string; responsavelAnterior: string }
  | { status: 'erro'; message: string }

export async function verificarCnpj(cnpj: string): Promise<VerificarCnpjResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'erro', message: 'Não autenticado.' }

  // Buscar cliente com esse CNPJ, incluindo nome do responsável via join
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, razao_social, area_tipo, responsavel_id, responsavel_desde, profiles!responsavel_id(full_name)')
    .eq('cnpj', cnpj)
    .maybeSingle()

  if (error) return { status: 'erro', message: error.message }

  // CNPJ não existe — pode criar
  if (!cliente) return { status: 'disponivel' }

  const areaTipo = (cliente.area_tipo as 'publica' | 'privada') ?? 'publica'
  const diasBloqueio = areaTipo === 'privada' ? 30 : 90

  const responsavelDesde = cliente.responsavel_desde
    ? new Date(cliente.responsavel_desde)
    : new Date()

  const expiracao = new Date(responsavelDesde.getTime() + diasBloqueio * 24 * 60 * 60 * 1000)
  const agora = new Date()

  const profileRaw = cliente.profiles
  const profileData = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
  const responsavelNome = (profileData as { full_name: string } | null)?.full_name ?? 'Desconhecido'

  if (agora < expiracao) {
    // Ainda dentro do bloqueio
    const dd = String(expiracao.getDate()).padStart(2, '0')
    const mm = String(expiracao.getMonth() + 1).padStart(2, '0')
    const yyyy = expiracao.getFullYear()
    return {
      status: 'bloqueado',
      responsavel: responsavelNome,
      expiracao: `${dd}/${mm}/${yyyy}`,
    }
  }

  // Bloqueio expirado — disponível para assumir
  return {
    status: 'livre_para_assumir',
    clienteId: cliente.id,
    responsavelAnterior: responsavelNome,
  }
}

export async function assumirCliente(clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar dados atuais para validar que o bloqueio realmente expirou
  const { data: cliente, error: fetchError } = await supabase
    .from('clientes')
    .select('area_tipo, responsavel_desde')
    .eq('id', clienteId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!cliente) return { error: 'Cliente não encontrado.' }

  const areaTipo = (cliente.area_tipo as 'publica' | 'privada') ?? 'publica'
  const diasBloqueio = areaTipo === 'privada' ? 30 : 90
  const responsavelDesde = cliente.responsavel_desde
    ? new Date(cliente.responsavel_desde)
    : new Date()
  const expiracao = new Date(responsavelDesde.getTime() + diasBloqueio * 24 * 60 * 60 * 1000)
  const agora = new Date()

  if (agora < expiracao) {
    return { error: 'O período de bloqueio deste cliente ainda não expirou.' }
  }

  const { error } = await supabase
    .from('clientes')
    .update({ responsavel_id: user.id, responsavel_desde: new Date().toISOString() })
    .eq('id', clienteId)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return {}
}

export async function createCliente(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const origemTipo = (formData.get('origem_tipo') as string) || null
  const parceiroId = (formData.get('parceiro_id') as string) || null
  const indicadoPor = (formData.get('indicado_por') as string) || null
  const areaTipo = (formData.get('area_tipo') as string) || 'publica'
  const cnpjRaw = (formData.get('cnpj') as string) || null

  const { error } = await supabase.from('clientes').insert({
    razao_social: formData.get('razao_social') as string,
    cnpj: cnpjRaw || null,
    contato_nome: (formData.get('contato_nome') as string) || null,
    contato_email: (formData.get('contato_email') as string) || null,
    contato_telefone: (formData.get('contato_telefone') as string) || null,
    segmento: (formData.get('segmento') as string) || null,
    observacoes: (formData.get('observacoes') as string) || null,
    origem_tipo: origemTipo as 'prospeccao_direta' | 'parceiro' | 'indicacao_interna' | null,
    parceiro_id: origemTipo === 'parceiro' ? parceiroId : null,
    indicado_por: origemTipo === 'indicacao_interna' ? indicadoPor : null,
    area_tipo: areaTipo as 'publica' | 'privada',
    responsavel_id: user.id,
    responsavel_desde: new Date().toISOString(),
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return {}
}

export async function updateCliente(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const origemTipo = (formData.get('origem_tipo') as string) || null
  const parceiroId = (formData.get('parceiro_id') as string) || null
  const indicadoPor = (formData.get('indicado_por') as string) || null

  const { error } = await supabase
    .from('clientes')
    .update({
      razao_social: formData.get('razao_social') as string,
      cnpj: (formData.get('cnpj') as string) || null,
      contato_nome: (formData.get('contato_nome') as string) || null,
      contato_email: (formData.get('contato_email') as string) || null,
      contato_telefone: (formData.get('contato_telefone') as string) || null,
      segmento: (formData.get('segmento') as string) || null,
      observacoes: (formData.get('observacoes') as string) || null,
      origem_tipo: origemTipo as 'prospeccao_direta' | 'parceiro' | 'indicacao_interna' | null,
      parceiro_id: origemTipo === 'parceiro' ? parceiroId : null,
      indicado_por: origemTipo === 'indicacao_interna' ? indicadoPor : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return {}
}

export async function deleteCliente(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('clientes').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return {}
}
