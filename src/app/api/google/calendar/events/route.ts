import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/calendar'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Buscar tokens do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', user.id)
    .single()

  if (!profile?.google_refresh_token) {
    return NextResponse.json(
      { error: 'google_not_connected' },
      { status: 400 }
    )
  }

  let body: {
    title: string
    description?: string
    startDateTime: string
    endDateTime: string
    attendeeEmails?: string[]
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const { title, description, startDateTime, endDateTime, attendeeEmails } = body

  if (!title || !startDateTime || !endDateTime) {
    return NextResponse.json(
      { error: 'Campos obrigatórios ausentes: title, startDateTime, endDateTime.' },
      { status: 400 }
    )
  }

  try {
    const result = await createCalendarEvent({
      userId: user.id,
      accessToken: profile.google_access_token ?? '',
      refreshToken: profile.google_refresh_token,
      tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
      title,
      description,
      startDateTime,
      endDateTime,
      attendeeEmails,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar evento no Google Calendar.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', user.id)
    .single()

  if (!profile?.google_refresh_token) {
    return NextResponse.json(
      { error: 'google_not_connected' },
      { status: 400 }
    )
  }

  let body: { eventId: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  if (!body.eventId) {
    return NextResponse.json({ error: 'eventId é obrigatório.' }, { status: 400 })
  }

  try {
    await deleteCalendarEvent({
      userId: user.id,
      accessToken: profile.google_access_token ?? '',
      refreshToken: profile.google_refresh_token,
      tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
      eventId: body.eventId,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir evento do Google Calendar.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
