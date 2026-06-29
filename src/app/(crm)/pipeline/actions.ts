'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { EstagioNegocio } from '@/types'
import { negocioSchema } from '@/lib/schemas'

export async function createNegocio(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawData = Object.fromEntries(formData)
  // responsavel_id é sempre o usuário autenticado — injetamos antes de validar
  rawData.responsavel_id = user.id
  const parsed = negocioSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const valorRaw = formData.get('valor_estimado') as string
  const probRaw = formData.get('probabilidade') as string
  const dataRaw = formData.get('data_previsao_fechamento') as string

  const dataFechamento = dataRaw || null
  const { error } = await supabase.from('negocios').insert({
    titulo: formData.get('titulo') as string,
    cliente_id: formData.get('cliente_id') as string,
    solucao_id: formData.get('solucao_id') as string,
    responsavel_id: user.id,
    estagio: formData.get('estagio') as EstagioNegocio,
    valor_estimado: valorRaw ? Number(valorRaw) : null,
    probabilidade: probRaw ? Number(probRaw) : null,
    data_previsao_fechamento: dataFechamento,
    data_previsao_original: dataFechamento,
    observacoes: (formData.get('observacoes') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return {}
}

export async function updateNegocio(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawData = Object.fromEntries(formData)
  // responsavel_id pode não estar no formData no update — injetamos para satisfazer o schema
  if (!rawData.responsavel_id) rawData.responsavel_id = user.id
  const parsed = negocioSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const valorRaw = formData.get('valor_estimado') as string
  const probRaw = formData.get('probabilidade') as string
  const dataRaw = formData.get('data_previsao_fechamento') as string

  const { error } = await supabase
    .from('negocios')
    .update({
      titulo: formData.get('titulo') as string,
      cliente_id: formData.get('cliente_id') as string,
      solucao_id: formData.get('solucao_id') as string,
      estagio: formData.get('estagio') as EstagioNegocio,
      valor_estimado: valorRaw ? Number(valorRaw) : null,
      probabilidade: probRaw ? Number(probRaw) : null,
      data_previsao_fechamento: dataRaw || null,
      observacoes: (formData.get('observacoes') as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return {}
}

export async function updateEstagioComData(
  id: string,
  estagio: string,
  novaData: string | null,
  periodicidade?: string | null,
  dataFechamento?: string | null,
  motivoPerda?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const estagiosValidos: EstagioNegocio[] = [
    'prospeccao', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido',
  ]
  if (!estagiosValidos.includes(estagio as EstagioNegocio)) return { error: 'Estágio inválido.' }

  const update: Record<string, unknown> = { estagio, updated_at: new Date().toISOString() }
  if (novaData) update.data_previsao_fechamento = novaData
  if (estagio === 'fechado_ganho') {
    update.periodicidade = periodicidade ?? null
    update.data_fechamento = dataFechamento ?? null
  }
  if (estagio === 'fechado_perdido') {
    update.motivo_perda = motivoPerda ?? null
  }

  const { error } = await supabase.from('negocios').update(update).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return {}
}

export async function deleteNegocio(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('negocios').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return {}
}
