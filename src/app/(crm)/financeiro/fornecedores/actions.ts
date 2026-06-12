'use server'

import { revalidatePath } from 'next/cache'
import { getAuthFinanceiro } from '@/lib/auth'

export async function createFornecedor(
  formData: FormData
): Promise<{ data?: { id: string; nome: string; telefone: string | null; pix_tipo: string | null; pix_chave: string | null }; error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()

  const { data, error } = await supabase
    .from('fornecedores')
    .insert({
      nome: formData.get('nome') as string,
      telefone: (formData.get('telefone') as string) || null,
      pix_tipo: (formData.get('pix_tipo') as string) || null,
      pix_chave: (formData.get('pix_chave') as string) || null,
      created_by: user.id,
    })
    .select('id, nome, telefone, pix_tipo, pix_chave')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return { data: data ?? undefined }
}

export async function updateFornecedor(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const { error } = await supabase
    .from('fornecedores')
    .update({
      nome: formData.get('nome') as string,
      telefone: (formData.get('telefone') as string) || null,
      pix_tipo: (formData.get('pix_tipo') as string) || null,
      pix_chave: (formData.get('pix_chave') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function deleteFornecedor(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  // Verificar se há contas_pagar vinculadas
  const { count, error: countError } = await supabase
    .from('contas_pagar')
    .select('id', { count: 'exact', head: true })
    .eq('fornecedor_id', id)

  if (countError) return { error: countError.message }

  if ((count ?? 0) > 0) {
    return { error: 'Fornecedor possui contas vinculadas e não pode ser excluído.' }
  }

  const { error } = await supabase.from('fornecedores').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}
