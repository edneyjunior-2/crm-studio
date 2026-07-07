'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertModulo } from '@/lib/gating'

export async function createComissao(formData: FormData): Promise<{ error?: string }> {
  const erroModulo = await assertModulo('comissoes')
  if (erroModulo) return { error: erroModulo }

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

  // TRAVA ATÔMICA: UPDATE condicional (status na própria mutação) — só afeta a
  // linha se ela ainda estiver 'previsto'. Elimina a race de duplo clique e
  // impede cancelado→pago (transição inválida) e re-pagamento (sobrescrever
  // data_pagamento de uma comissão já paga). Mesmo padrão de marcarPago/
  // marcarRecebido em financeiro/actions.ts.
  const { data: updated, error } = await supabase
    .from('comissoes_comercial')
    .update({ status: 'pago', data_pagamento: dataPagamento })
    .eq('id', id)
    .eq('status', 'previsto')
    .select('id')

  if (error) return { error: error.message }

  if (!updated || updated.length === 0) {
    // 0 linhas: já não estava 'previsto'. Descobre o motivo p/ mensagem amigável.
    const { data: atual } = await supabase
      .from('comissoes_comercial')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    if (!atual) return { error: 'Comissão não encontrada.' }
    if (atual.status === 'pago') return {} // já paga → idempotente
    return { error: 'Comissão não está prevista para pagamento.' }
  }

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

  // TRAVA ATÔMICA: só cancela comissão 'previsto'. Sem essa condição, cancelar
  // uma comissão já 'pago' mudava o status mas mantinha data_pagamento — o
  // dinheiro pago sumia dos relatórios (status='cancelado' é filtrado fora).
  const { data: updated, error } = await supabase
    .from('comissoes_comercial')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .eq('status', 'previsto')
    .select('id')

  if (error) return { error: error.message }

  if (!updated || updated.length === 0) {
    // 0 linhas: já não estava 'previsto'. Descobre o motivo p/ mensagem amigável.
    const { data: atual } = await supabase
      .from('comissoes_comercial')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    if (!atual) return { error: 'Comissão não encontrada.' }
    if (atual.status === 'cancelado') return {} // já cancelada → idempotente
    return { error: 'Não é possível cancelar uma comissão já paga.' }
  }

  revalidatePath('/financeiro')
  revalidatePath('/financeiro/comissoes')
  return {}
}
