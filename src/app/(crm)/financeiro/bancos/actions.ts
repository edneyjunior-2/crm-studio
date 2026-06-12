'use server'

import { revalidatePath } from 'next/cache'
import { getAuthFinanceiro } from '@/lib/auth'

export async function createBanco(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()
  const userId = user.id

  const saldoRaw = formData.get('saldo_inicial') as string
  const saldoInicial = saldoRaw !== '' ? Number(saldoRaw) : 0

  const { error } = await supabase.from('bancos').insert({
    nome: formData.get('nome') as string,
    instituicao: (formData.get('instituicao') as string) || null,
    agencia: (formData.get('agencia') as string) || null,
    conta: (formData.get('conta') as string) || null,
    tipo: (formData.get('tipo') as string) || 'corrente',
    saldo_inicial: saldoInicial,
    pix_tipo: (formData.get('pix_tipo') as string) || null,
    pix_chave: (formData.get('pix_chave') as string) || null,
    ativo: true,
    created_by: userId,
  })

  if (error) return { error: error.message }

  revalidatePath('/financeiro/bancos')
  return {}
}

export async function updateBanco(id: string, formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const saldoRaw = formData.get('saldo_inicial') as string
  const saldoInicial = saldoRaw !== '' ? Number(saldoRaw) : 0

  const { error } = await supabase
    .from('bancos')
    .update({
      nome: formData.get('nome') as string,
      instituicao: (formData.get('instituicao') as string) || null,
      agencia: (formData.get('agencia') as string) || null,
      conta: (formData.get('conta') as string) || null,
      tipo: (formData.get('tipo') as string) || 'corrente',
      saldo_inicial: saldoInicial,
      pix_tipo: (formData.get('pix_tipo') as string) || null,
      pix_chave: (formData.get('pix_chave') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro/bancos')
  revalidatePath(`/financeiro/bancos/${id}`)
  return {}
}

export async function deleteBanco(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const { error } = await supabase.from('bancos').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro/bancos')
  return {}
}

export async function createMovimentacao(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()
  const userId = user.id

  const bancoId = formData.get('banco_id') as string
  const valorRaw = formData.get('valor') as string
  const valor = valorRaw !== '' ? Number(valorRaw) : 0

  const { error } = await supabase.from('movimentacoes').insert({
    banco_id: bancoId,
    tipo: formData.get('tipo') as string,
    valor,
    moeda: (formData.get('moeda') as string) || 'BRL',
    descricao: formData.get('descricao') as string,
    categoria: (formData.get('categoria') as string) || null,
    destino_origem: (formData.get('destino_origem') as string) || null,
    data: formData.get('data') as string,
    created_by: userId,
  })

  if (error) return { error: error.message }

  revalidatePath('/financeiro/bancos')
  revalidatePath(`/financeiro/bancos/${bancoId}`)
  return {}
}

export async function deleteMovimentacao(id: string, bancoId: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const { error } = await supabase.from('movimentacoes').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro/bancos')
  revalidatePath(`/financeiro/bancos/${bancoId}`)
  return {}
}
