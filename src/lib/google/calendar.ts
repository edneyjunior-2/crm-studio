import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(state: string): string {
  const auth = getOAuthClient()
  return auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  })
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expiry_date: number
}> {
  const auth = getOAuthClient()
  const { tokens } = await auth.getToken(code)

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Tokens incompletos retornados pelo Google.')
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  }
}

/** Renova o access_token usando o refresh_token e persiste no banco. */
async function refreshAndSaveToken(
  userId: string,
  refreshToken: string
): Promise<string> {
  const auth = getOAuthClient()
  auth.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await auth.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Não foi possível renovar o token de acesso do Google.')
  }

  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({
      google_access_token: credentials.access_token,
      google_token_expiry: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
    })
    .eq('id', userId)

  return credentials.access_token
}

interface CalendarEventParams {
  userId: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
  title: string
  description?: string
  startDateTime: string
  endDateTime: string
  attendeeEmails?: string[]
  /** Cria um Google Meet vinculado ao evento. Default false — chamadores existentes
   *  (atividades/follow-up do pipeline) não devem ganhar Meet sem pedir. */
  createMeet?: boolean
  /** Link externo (Zoom/Teams etc). Mutuamente exclusivo com createMeet — quando
   *  presente, vai pro campo `location` do evento e nenhum Meet é solicitado. */
  externalLink?: string
  /** Recorrência via RRULE. Só tem efeito em evento novo (sem suporte a editar
   *  recorrência de um evento já existente). */
  recurrence?: 'semanal' | 'mensal' | 'anual'
}

interface CalendarEventResult {
  eventId: string
  eventUrl: string
  meetLink?: string
}

/** Retorna um cliente OAuth com token válido (renova automaticamente se necessário). */
async function getValidAuthClient(
  userId: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiry: string
): Promise<ReturnType<typeof getOAuthClient>> {
  const auth = getOAuthClient()
  const expiry = new Date(tokenExpiry).getTime()
  const now = Date.now()

  // Renova se faltam menos de 5 minutos para expirar
  if (now >= expiry - 5 * 60 * 1000) {
    const newToken = await refreshAndSaveToken(userId, refreshToken)
    auth.setCredentials({ access_token: newToken, refresh_token: refreshToken })
  } else {
    auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  }

  return auth
}

export async function createCalendarEvent(
  params: CalendarEventParams
): Promise<CalendarEventResult> {
  const {
    userId,
    accessToken,
    refreshToken,
    tokenExpiry,
    title,
    description,
    startDateTime,
    endDateTime,
    attendeeEmails,
    createMeet,
    externalLink,
    recurrence,
  } = params

  const auth = await getValidAuthClient(userId, accessToken, refreshToken, tokenExpiry)
  const calendar = google.calendar({ version: 'v3', auth })

  // Meet e link externo são mutuamente exclusivos (mesma regra do UX atual):
  // se há link externo, ele vai pro campo location e nenhum Meet é pedido.
  const useMeet = !!createMeet && !externalLink

  const rrule =
    recurrence === 'semanal' ? ['RRULE:FREQ=WEEKLY']
    : recurrence === 'mensal' ? ['RRULE:FREQ=MONTHLY']
    : recurrence === 'anual'  ? ['RRULE:FREQ=YEARLY']
    : undefined

  const event = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: useMeet ? 1 : 0,
    requestBody: {
      summary: title,
      description: description ?? '',
      location: externalLink,
      start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
      attendees: attendeeEmails?.map((email) => ({ email })) ?? [],
      ...(rrule && { recurrence: rrule }),
      ...(useMeet && {
        conferenceData: {
          createRequest: {
            requestId: `crm-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    },
  })

  const eventId = event.data.id
  const eventUrl = event.data.htmlLink

  if (!eventId || !eventUrl) {
    throw new Error('Evento criado, mas ID/URL não retornados pelo Google.')
  }

  const meetLink = event.data.conferenceData?.entryPoints?.[0]?.uri ?? undefined

  return { eventId, eventUrl, meetLink }
}

interface UpdateCalendarEventParams {
  userId: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
  eventId: string
  title: string
  description?: string
  startDateTime: string
  endDateTime: string
  attendeeEmails?: string[]
  externalLink?: string
}

/** Espelha createCalendarEvent, mas atualiza um evento existente via patch.
 *  Não mexe no Meet do evento (mantém o que já existir, se existir). */
export async function updateCalendarEvent(
  params: UpdateCalendarEventParams
): Promise<CalendarEventResult> {
  const {
    userId,
    accessToken,
    refreshToken,
    tokenExpiry,
    eventId,
    title,
    description,
    startDateTime,
    endDateTime,
    attendeeEmails,
    externalLink,
  } = params

  const auth = await getValidAuthClient(userId, accessToken, refreshToken, tokenExpiry)
  const calendar = google.calendar({ version: 'v3', auth })

  const event = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: {
      summary: title,
      description: description ?? '',
      location: externalLink,
      start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
      // Sem "?? []": se attendeeEmails vier undefined, omite o campo do patch em
      // vez de mandar array vazio — o Google Calendar SUBSTITUI (não faz merge)
      // a lista de convidados no que for enviado, então "[]" apagaria convidados
      // reais do evento. Ver editarEvento em calendario/actions.ts.
      attendees: attendeeEmails?.map((email) => ({ email })),
    },
  })

  const updatedEventId = event.data.id
  const eventUrl = event.data.htmlLink

  if (!updatedEventId || !eventUrl) {
    throw new Error('Evento atualizado, mas ID/URL não retornados pelo Google.')
  }

  const meetLink = event.data.conferenceData?.entryPoints?.[0]?.uri ?? undefined

  return { eventId: updatedEventId, eventUrl, meetLink }
}

interface DeleteEventParams {
  userId: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
  eventId: string
}

export async function deleteCalendarEvent(params: DeleteEventParams): Promise<void> {
  const { userId, accessToken, refreshToken, tokenExpiry, eventId } = params

  const auth = await getValidAuthClient(userId, accessToken, refreshToken, tokenExpiry)
  const calendar = google.calendar({ version: 'v3', auth })

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  })
}

/** Janela de tempo usada no full sync inicial — não traz o histórico de vida inteiro. */
const FULL_SYNC_DIAS_PASSADO = 7
const FULL_SYNC_DIAS_FUTURO  = 90

export interface GoogleCalendarEventRaw {
  id?: string | null
  status?: string | null
  summary?: string | null
  description?: string | null
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
}

interface ListEventsParams {
  userId: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
  /** syncToken salvo da última passada — omitido/undefined dispara full sync. */
  syncToken?: string | null
}

type ListEventsResult =
  | { ok: true; events: GoogleCalendarEventRaw[]; nextSyncToken: string | null }
  /** syncToken inválido/expirado (410 do Google) — chamador deve limpar o token salvo e refazer full sync. */
  | { ok: false; tokenInvalido: true }

/**
 * Lista eventos do calendário 'primary' do usuário — incremental (com
 * syncToken) ou full sync inicial (janela de tempo, sem syncToken). Pagina
 * até o fim e retorna o nextSyncToken pra próxima chamada incremental.
 *
 * No full sync inicial, o nextSyncToken vem na última página da própria
 * consulta com janela de tempo (timeMin/timeMax) — a API do Google carrega
 * esse mesmo filtro de tempo para as chamadas incrementais seguintes que
 * usarem esse token, então uma segunda chamada separada não é necessária.
 */
export async function listGoogleCalendarEvents(
  params: ListEventsParams,
): Promise<ListEventsResult> {
  const { userId, accessToken, refreshToken, tokenExpiry, syncToken } = params

  const auth = await getValidAuthClient(userId, accessToken, refreshToken, tokenExpiry)
  const calendar = google.calendar({ version: 'v3', auth })

  const events: GoogleCalendarEventRaw[] = []
  let nextSyncToken: string | null = null

  try {
    if (syncToken) {
      // Sync incremental — Google decide o que mudou desde o token salvo.
      let pageToken: string | undefined
      do {
        const res = await calendar.events.list({
          calendarId: 'primary',
          syncToken,
          singleEvents: true,
          pageToken,
        })
        events.push(...(res.data.items ?? []))
        pageToken = res.data.nextPageToken ?? undefined
        if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken
      } while (pageToken)
    } else {
      // Full sync inicial — janela de tempo útil.
      const timeMin = new Date(Date.now() - FULL_SYNC_DIAS_PASSADO * 24 * 60 * 60 * 1000).toISOString()
      const timeMax = new Date(Date.now() + FULL_SYNC_DIAS_FUTURO * 24 * 60 * 60 * 1000).toISOString()

      let pageToken: string | undefined
      do {
        const res = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          timeMax,
          singleEvents: true,
          pageToken,
        })
        events.push(...(res.data.items ?? []))
        pageToken = res.data.nextPageToken ?? undefined
        if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken
      } while (pageToken)
    }

    return { ok: true, events, nextSyncToken }
  } catch (err) {
    const status = (err as { code?: number; response?: { status?: number } })?.code
      ?? (err as { response?: { status?: number } })?.response?.status
    if (status === 410) {
      return { ok: false, tokenInvalido: true }
    }
    throw err
  }
}
