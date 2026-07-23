'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'

export async function criarPrazo(
  processoId:    string,
  descricao:     string,
  dataPrazo:     string,
  responsavelId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!descricao.trim() || !dataPrazo) return { error: 'Descrição e data são obrigatórios.' }

  const { empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { data: proc } = await supabase
    .from('processos_juridicos').select('id')
    .eq('id', processoId).eq('empresa_id', empresaId).single()
  if (!proc) return { error: 'Processo não encontrado.' }

  const { error } = await supabase.from('processos_prazos').insert({
    processo_id:    processoId,
    descricao:      descricao.trim(),
    data_prazo:     dataPrazo,
    responsavel_id: responsavelId || null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/processos/${processoId}`)
  return {}
}

export async function marcarPrazoCumprido(
  prazoId:    string,
  processoId: string,
  cumprido:   boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase
    .from('processos_prazos').update({ cumprido }).eq('id', prazoId)
  if (error) return { error: error.message }
  revalidatePath(`/processos/${processoId}`)
  return {}
}

export async function editarPrazo(
  prazoId:        string,
  processoId:     string,
  descricao:      string,
  dataPrazo:      string,
  responsavelId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!descricao.trim() || !dataPrazo) return { error: 'Descrição e data são obrigatórios.' }

  const { data, error } = await supabase
    .from('processos_prazos')
    .update({
      descricao:      descricao.trim(),
      data_prazo:     dataPrazo,
      responsavel_id: responsavelId || null,
    })
    .eq('id', prazoId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Prazo não encontrado ou sem permissão.' }
  revalidatePath(`/processos/${processoId}`)
  revalidatePath('/calendario')
  return {}
}

export async function excluirPrazo(
  prazoId:    string,
  processoId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase
    .from('processos_prazos').delete().eq('id', prazoId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Sem permissão para excluir este prazo.' }
  revalidatePath(`/processos/${processoId}`)
  return {}
}
