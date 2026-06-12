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

  // Salvar a atividade no banco
  const { error: atividadeErr } = await supabase.from('atividades').insert({
    negocio_id: negocioId,
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
