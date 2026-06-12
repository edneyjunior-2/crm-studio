'use server'

import { revalidatePath } from 'next/cache'
import { getAuthFinanceiro } from '@/lib/auth'

export async function createParceiroComissao(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()

  const { error } = await supabase.from('parceiros_comissao').insert({
    nome: formData.get('nome') as string,
    cnpj: (formData.get('cnpj') as string) || null,
    contato_nome: (formData.get('contato_nome') as string) || null,
    contato_email: (formData.get('contato_email') as string) || null,
    contato_telefone: (formData.get('contato_telefone') as string) || null,
    pix_tipo: (formData.get('pix_tipo') as string) || null,
    pix_chave: (formData.get('pix_chave') as string) || null,
    banco_nome: (formData.get('banco_nome') as string) || null,
    banco_agencia: (formData.get('banco_agencia') as string) || null,
    banco_conta: (formData.get('banco_conta') as string) || null,
    observacoes: (formData.get('observacoes') as string) || null,
    ativo: true,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function updateParceiroComissao(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const { error } = await supabase
    .from('parceiros_comissao')
    .update({
      nome: formData.get('nome') as string,
      cnpj: (formData.get('cnpj') as string) || null,
      contato_nome: (formData.get('contato_nome') as string) || null,
      contato_email: (formData.get('contato_email') as string) || null,
      contato_telefone: (formData.get('contato_telefone') as string) || null,
      pix_tipo: (formData.get('pix_tipo') as string) || null,
      pix_chave: (formData.get('pix_chave') as string) || null,
      banco_nome: (formData.get('banco_nome') as string) || null,
      banco_agencia: (formData.get('banco_agencia') as string) || null,
      banco_conta: (formData.get('banco_conta') as string) || null,
      observacoes: (formData.get('observacoes') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function inativarParceiroComissao(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const { error } = await supabase
    .from('parceiros_comissao')
    .update({ ativo: false })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}
