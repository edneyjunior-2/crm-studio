'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

const STATUS_OBRA  = ['orcamento', 'em_andamento', 'pausada', 'concluida', 'cancelada'] as const
const STATUS_ETAPA = ['pendente', 'em_andamento', 'concluida'] as const
const STATUS_MEDICAO = ['pendente', 'aprovada', 'faturada'] as const

export async function atualizarStatusObra(
  id: string,
  status: string,
): Promise<{ error?: string }> {
  if (!(STATUS_OBRA as readonly string[]).includes(status)) {
    return { error: 'Status inválido.' }
  }

  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { error } = await supabase
    .from('obras')
    .update({ status })
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${id}`)
  revalidatePath('/obras')
  return {}
}

export async function atualizarObra(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const obraId = (formData.get('obra_id') as string)?.trim()
  if (!obraId) return { error: 'ID da obra não informado.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { error: 'Nome da obra é obrigatório.' }

  const tipo            = (formData.get('tipo') as string)?.trim() || null
  const clienteId       = (formData.get('cliente_id') as string)?.trim() || null
  const responsavelId   = (formData.get('responsavel_id') as string)?.trim() || null
  const endereco        = (formData.get('endereco') as string)?.trim() || null
  const cidade          = (formData.get('cidade') as string)?.trim() || null
  const estado          = (formData.get('estado') as string)?.trim() || null
  const artNumero       = (formData.get('art_numero') as string)?.trim() || null
  const descricao       = (formData.get('descricao') as string)?.trim() || null
  const statusRaw       = (formData.get('status') as string)?.trim()
  const status          = (STATUS_OBRA as readonly string[]).includes(statusRaw) ? statusRaw : 'orcamento'
  const dataInicio      = (formData.get('data_inicio') as string)?.trim() || null
  const dataPrevisao    = (formData.get('data_previsao_termino') as string)?.trim() || null
  const valorRaw        = (formData.get('valor_contrato') as string)?.replace(/\./g, '').replace(',', '.').trim()
  const valorNum        = valorRaw ? parseFloat(valorRaw) : null
  const valorContrato   = valorNum != null && !Number.isNaN(valorNum) ? valorNum : null

  const { error } = await supabase
    .from('obras')
    .update({
      nome,
      tipo,
      cliente_id:            clienteId || null,
      responsavel_id:        responsavelId || null,
      endereco,
      cidade,
      estado,
      art_numero:            artNumero,
      descricao,
      status,
      data_inicio:           dataInicio || null,
      data_previsao_termino: dataPrevisao || null,
      valor_contrato:        valorContrato,
    })
    .eq('id', obraId)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  revalidatePath('/obras')
  redirect(`/obras/${obraId}`)
}

export async function deletarObra(id: string): Promise<{ error?: string }> {
  const { supabase, empresaId, role } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }
  if (role !== 'admin') return { error: 'Apenas administradores podem excluir obras.' }

  const { error } = await supabase
    .from('obras')
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/obras')
  redirect('/obras')
}

export async function criarEtapa(
  obraId: string,
  dados: {
    nome: string
    descricao?: string | null
    percentual_obra?: number | null
    valor?: number | null
    data_previsao?: string | null
    ordem: number
  },
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  // Verifica que a obra pertence à empresa antes de inserir
  const { data: obra } = await supabase
    .from('obras')
    .select('id')
    .eq('id', obraId)
    .eq('empresa_id', empresaId)
    .single()
  if (!obra) return { error: 'Obra não encontrada.' }

  const { error } = await supabase
    .from('obras_etapas')
    .insert({
      obra_id:         obraId,
      nome:            dados.nome,
      descricao:       dados.descricao ?? null,
      percentual_obra: dados.percentual_obra ?? null,
      valor:           dados.valor ?? null,
      data_previsao:   dados.data_previsao ?? null,
      ordem:           dados.ordem,
      status:          'pendente',
    })

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function atualizarStatusEtapa(
  etapaId: string,
  obraId: string,
  status: string,
): Promise<{ error?: string }> {
  if (!(STATUS_ETAPA as readonly string[]).includes(status)) {
    return { error: 'Status inválido.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase
    .from('obras_etapas')
    .update({ status })
    .eq('id', etapaId)
    .eq('obra_id', obraId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function excluirEtapa(
  etapaId: string,
  obraId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Apenas administradores podem excluir etapas.' }

  const { error } = await supabase
    .from('obras_etapas')
    .delete()
    .eq('id', etapaId)
    .eq('obra_id', obraId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function criarMedicao(
  obraId: string,
  dados: {
    descricao: string
    percentual?: number | null
    valor?: number | null
    data_medicao?: string | null
  },
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  // Verifica ownership e calcula próximo número de medição
  const [{ data: obra }, { data: ultimaMedicao }] = await Promise.all([
    supabase
      .from('obras')
      .select('id')
      .eq('id', obraId)
      .eq('empresa_id', empresaId)
      .single(),
    supabase
      .from('obras_medicoes')
      .select('numero_medicao')
      .eq('obra_id', obraId)
      .order('numero_medicao', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!obra) return { error: 'Obra não encontrada.' }

  const numeroMedicao = (ultimaMedicao?.numero_medicao ?? 0) + 1

  const { error } = await supabase
    .from('obras_medicoes')
    .insert({
      obra_id:         obraId,
      numero_medicao:  numeroMedicao,
      descricao:       dados.descricao,
      percentual:      dados.percentual ?? null,
      valor:           dados.valor ?? null,
      data_medicao:    dados.data_medicao ?? null,
      status:          'pendente',
    })

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function atualizarStatusMedicao(
  medicaoId: string,
  obraId: string,
  status: string,
): Promise<{ error?: string }> {
  if (!(STATUS_MEDICAO as readonly string[]).includes(status)) {
    return { error: 'Status inválido.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase
    .from('obras_medicoes')
    .update({ status })
    .eq('id', medicaoId)
    .eq('obra_id', obraId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function excluirMedicao(
  medicaoId: string,
  obraId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Apenas administradores podem excluir medições.' }

  const { error } = await supabase
    .from('obras_medicoes')
    .delete()
    .eq('id', medicaoId)
    .eq('obra_id', obraId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}
