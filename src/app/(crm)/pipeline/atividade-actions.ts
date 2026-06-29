'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent } from '@/lib/google/calendar'

interface RegistrarReuniaoParams {
  negocioId: string
  descricao: string
  dataAtividade: string
  startDateTime?: string
  endDateTime?: string
  adicionarCalendario: boolean
  tituloEvento: string
  descricaoEvento?: string
}

interface RegistrarReuniaoResult {
  error?: string
  googleEventUrl?: string
}

export async function registrarReuniaoComCalendar(
  params: RegistrarReuniaoParams
): Promise<RegistrarReuniaoResult> {
  const {
    negocioId,
    descricao,
    dataAtividade,
    startDateTime,
    endDateTime,
    adicionarCalendario,
    tituloEvento,
    descricaoEvento,
  } = params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let googleEventId: string | null = null
  let googleEventUrl: string | null = null

  // Criar evento no Google Calendar se solicitado
  if (adicionarCalendario && startDateTime && endDateTime) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expiry')
      .eq('id', user.id)
      .single()

    if (!profile?.google_refresh_token) {
      return { error: 'Google Calendar não conectado. Acesse as Configurações para conectar.' }
    }

    try {
      const result = await createCalendarEvent({
        userId: user.id,
        accessToken: profile.google_access_token ?? '',
        refreshToken: profile.google_refresh_token,
        tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
        title: tituloEvento,
        description: descricaoEvento,
        startDateTime,
        endDateTime,
      })

      googleEventId = result.eventId
      googleEventUrl = result.eventUrl
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar evento no Google Calendar.'
      return { error: message }
    }
  }

  // cliente_id derivado do negócio → a atividade aparece também no detalhe do cliente.
  const { data: negReuniao } = await supabase.from('negocios').select('cliente_id').eq('id', negocioId).single()

  // Salvar a atividade no banco
  const { error: atividadeErr } = await supabase.from('atividades').insert({
    negocio_id: negocioId,
    cliente_id: negReuniao?.cliente_id ?? null,
    responsavel_id: user.id,
    tipo: 'reuniao',
    descricao,
    data_atividade: dataAtividade,
    google_event_id: googleEventId,
    google_event_url: googleEventUrl,
  })

  if (atividadeErr) {
    return { error: atividadeErr.message }
  }

  revalidatePath('/pipeline')
  revalidatePath('/dashboard')

  return { googleEventUrl: googleEventUrl ?? undefined }
}

export interface AtividadeItem {
  id: string
  tipo: 'ligacao' | 'email' | 'reuniao' | 'proposta' | 'nota'
  descricao: string | null
  data_atividade: string
  responsavel_nome: string | null
  google_event_url?: string | null
}

export async function listarAtividades(params: {
  negocioId?: string
  clienteId?: string
}): Promise<AtividadeItem[]> {
  const { getAuthUser } = await import('@/lib/auth')
  const { supabase } = await getAuthUser()

  let query = supabase
    .from('atividades')
    .select('id, tipo, descricao, data_atividade, google_event_url, profiles!responsavel_id(full_name)')
    .order('data_atividade', { ascending: false })
    .order('created_at', { ascending: false })

  if (params.negocioId) {
    query = query.eq('negocio_id', params.negocioId)
  } else if (params.clienteId) {
    query = query.eq('cliente_id', params.clienteId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[listarAtividades] erro:', error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    tipo: row.tipo as AtividadeItem['tipo'],
    descricao: row.descricao as string | null,
    data_atividade: row.data_atividade as string,
    responsavel_nome: (Array.isArray(row.profiles)
      ? (row.profiles[0]?.full_name ?? null)
      : (row.profiles?.full_name ?? null)) as string | null,
    google_event_url: row.google_event_url as string | null,
  }))
}
