'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import type { EstagioNegocio } from '@/types'
import { negocioSchema } from '@/lib/schemas'
import { deleteCalendarEvent } from '@/lib/google/calendar'

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
  const auth = await getAuthUser()
  if (!auth.user) redirect('/login')

  // Consulta o tipo da etapa de destino para decidir comportamento (sem hardcode de slugs)
  let tipoEstagio: 'aberto' | 'ganho' | 'perdido' = 'aberto'
  if (auth.empresaId) {
    const { data: estagioRow } = await supabase
      .from('pipeline_estagios')
      .select('tipo')
      .eq('empresa_id', auth.empresaId)
      .eq('slug', estagio)
      .maybeSingle()
    if (estagioRow) tipoEstagio = estagioRow.tipo as 'aberto' | 'ganho' | 'perdido'
  } else {
    // fallback: tenta adivinhar pelo slug legado
    if (estagio === 'fechado_ganho') tipoEstagio = 'ganho'
    else if (estagio === 'fechado_perdido') tipoEstagio = 'perdido'
  }

  const update: Record<string, unknown> = { estagio, updated_at: new Date().toISOString() }
  if (novaData) update.data_previsao_fechamento = novaData

  if (tipoEstagio === 'ganho') {
    update.periodicidade = periodicidade ?? null
    update.data_fechamento = dataFechamento ?? null
    update.motivo_perda = null
  } else if (tipoEstagio === 'perdido') {
    update.motivo_perda = motivoPerda ?? null
    update.data_fechamento = dataFechamento ?? null
  } else {
    // aberto: limpa data de fechamento e motivo de perda
    update.data_fechamento = null
    update.motivo_perda = null
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

  // Best-effort: limpar eventos órfãos no Google Calendar antes de excluir
  try {
    const { data: atividades } = await supabase
      .from('atividades')
      .select('google_event_id, responsavel_id')
      .eq('negocio_id', id)
      .not('google_event_id', 'is', null)

    if (atividades && atividades.length > 0) {
      // Buscar tokens do usuário autenticado (responsável pela exclusão)
      const { data: profile } = await supabase
        .from('profiles')
        .select('google_access_token, google_refresh_token, google_token_expiry')
        .eq('id', user.id)
        .single()

      if (profile?.google_refresh_token) {
        for (const atividade of atividades) {
          if (!atividade.google_event_id) continue
          try {
            await deleteCalendarEvent({
              userId: user.id,
              accessToken: profile.google_access_token ?? '',
              refreshToken: profile.google_refresh_token,
              tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
              eventId: atividade.google_event_id,
            })
          } catch {
            // Ignora falha individual (evento já pode ter sido excluído manualmente)
          }
        }
      }
    }
  } catch {
    // Falha no cleanup do Google não bloqueia a exclusão do negócio
  }

  const { error } = await supabase.from('negocios').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return {}
}

export async function reabrirNegocio(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const auth = await getAuthUser()
  if (!auth.user) redirect('/login')

  // Resolve dinamicamente a 1ª etapa ativa do tipo 'aberto' da empresa efetiva
  let slugReaberto: string | null = null
  if (auth.empresaId) {
    const { data: primeiraEtapa } = await supabase
      .from('pipeline_estagios')
      .select('slug')
      .eq('empresa_id', auth.empresaId)
      .eq('tipo', 'aberto')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle()
    slugReaberto = primeiraEtapa?.slug ?? null
  }

  if (!slugReaberto) {
    return { error: 'Não há etapas abertas configuradas no funil. Adicione ao menos uma etapa do tipo "aberto" nas configurações de pipeline.' }
  }

  const { error } = await supabase
    .from('negocios')
    .update({
      estagio: slugReaberto,
      data_fechamento: null,
      motivo_perda: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  revalidatePath('/pipeline/historico-perdidos')
  return {}
}
