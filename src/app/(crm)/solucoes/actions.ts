'use server'

import { revalidatePath } from 'next/cache'
import { getAuthAdmin } from '@/lib/auth'

export async function createSolucao(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthAdmin()

  const comissaoRaw = formData.get('comissao_percentual') as string
  const comissao = comissaoRaw ? parseFloat(comissaoRaw) : null

  const { error } = await supabase.from('solucoes').insert({
    nome: formData.get('nome') as string,
    empresa_representada: (formData.get('empresa_representada') as string) || null,
    descricao: (formData.get('descricao') as string) || null,
    comissao_percentual: comissao,
    ativo: formData.get('ativo') === 'true',
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/solucoes')
  return {}
}

export async function updateSolucao(id: string, formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthAdmin()

  const comissaoRaw = formData.get('comissao_percentual') as string
  const comissao = comissaoRaw ? parseFloat(comissaoRaw) : null

  const { error } = await supabase
    .from('solucoes')
    .update({
      nome: formData.get('nome') as string,
      empresa_representada: (formData.get('empresa_representada') as string) || null,
      descricao: (formData.get('descricao') as string) || null,
      comissao_percentual: comissao,
      ativo: formData.get('ativo') === 'true',
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/solucoes')
  revalidatePath(`/solucoes/${id}`)
  return {}
}

export async function deleteSolucao(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthAdmin()

  const { error } = await supabase.from('solucoes').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/solucoes')
  return {}
}

export async function toggleAtivo(id: string, ativo: boolean): Promise<{ error?: string }> {
  const { supabase } = await getAuthAdmin()

  const { error } = await supabase
    .from('solucoes')
    .update({ ativo })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/solucoes')
  return {}
}
