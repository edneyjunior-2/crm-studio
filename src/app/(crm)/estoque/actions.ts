'use server'

import { revalidatePath } from 'next/cache'
import { getAuthFinanceiro } from '@/lib/auth'
import { produtoSchema, movimentacaoEstoqueSchema } from '@/lib/schemas-estoque'

// ─── Produtos ────────────────────────────────────────────────────────────────

export async function createProduto(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()

  const raw = Object.fromEntries(formData)
  const parsed = produtoSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const { error } = await supabase.from('produtos').insert({
    ...parsed.data,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/estoque')
  return {}
}

export async function updateProduto(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const raw = Object.fromEntries(formData)
  const parsed = produtoSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const { error } = await supabase
    .from('produtos')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/estoque')
  return {}
}

export async function deleteProduto(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const { error } = await supabase.from('produtos').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/estoque')
  return {}
}

// ─── Movimentações ───────────────────────────────────────────────────────────

export async function registrarMovimentacao(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()

  const raw = Object.fromEntries(formData)
  const parsed = movimentacaoEstoqueSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const { error } = await supabase.from('movimentacoes_estoque').insert({
    produto_id:    parsed.data.produto_id,
    tipo:          parsed.data.tipo,
    quantidade:    parsed.data.quantidade,
    custo_unitario: parsed.data.custo_unitario ?? null,
    motivo:        parsed.data.motivo ?? null,
    data:          parsed.data.data,
    created_by:    user.id,
    // TODO(integração): negocio_id ao integrar com o pipeline
  })

  if (error) return { error: error.message }

  revalidatePath('/estoque')
  return {}
}
