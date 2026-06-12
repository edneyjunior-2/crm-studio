'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createComissao(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'socio'].includes(profile.role)) {
    return { error: 'Sem permissão.' }
  }

  const valorRaw = formData.get('valor') as string
  const negocioId = formData.get('negocio_id') as string
  const comercialId = (formData.get('comercial_id') as string) || null
  const parceiroId = (formData.get('parceiro_id') as string) || null

  if (!comercialId && !parceiroId) {
    return { error: 'Selecione um colaborador ou parceiro para a comissão.' }
  }

  const { error } = await supabase.from('comissoes_comercial').insert({
    comercial_id: comercialId || null,
    parceiro_id: parceiroId || null,
    negocio_id: negocioId || null,
    descricao: formData.get('descricao') as string,
    valor: Number(valorRaw),
    data_previsao: formData.get('data_previsao') as string,
    observacoes: (formData.get('observacoes') as string) || null,
    status: 'previsto',
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/financeiro/comissoes')
  return {}
}

export async function marcarComissaoPaga(
  id: string,
  dataPagamento: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'socio'].includes(profile.role)) {
    return { error: 'Sem permissão.' }
  }

  const { error } = await supabase
    .from('comissoes_comercial')
    .update({ status: 'pago', data_pagamento: dataPagamento })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/financeiro/comissoes')
  return {}
}

export async function cancelarComissao(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'socio'].includes(profile.role)) {
    return { error: 'Sem permissão.' }
  }

  const { error } = await supabase
    .from('comissoes_comercial')
    .update({ status: 'cancelado' })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/financeiro/comissoes')
  return {}
}
