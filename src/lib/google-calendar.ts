import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis'

/**
 * Arquitetura: Service Account + Domain-Wide Delegation (DWD).
 * GOOGLE_IMPERSONATE_EMAIL: endereço do usuário Google Workspace cujo calendário
 * será gerenciado. Obrigatório quando GOOGLE_CALENDAR_ID não é o calendário primário
 * da service account. Sem DWD configurado no Google Admin, operações em calendários
 * de outros usuários resultam em 403.
 */
// subject: se fornecido, impersona esse usuário via DWD (Domain-Wide Delegation).
// Sem ele, usa GOOGLE_IMPERSONATE_EMAIL como fallback (útil para listagem e deleção).
// Todos os usuários impersonados devem pertencer ao mesmo Google Workspace onde o DWD está configurado.
function getAuth(subject?: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY ?? ''
  const key = rawKey
    .replace(/\\n/g, '\n')
    .replace(/^["']|["']$/g, '')
  if (!email || !key) return null

  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    subject: subject ?? (process.env.GOOGLE_IMPERSONATE_EMAIL || undefined),
  })
}

export const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? ''

export function isConfigured() {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_CALENDAR_ID
  )
}

// Busca eventos de um calendário específico, com impersonação opcional via DWD.
// Erros são silenciados para não quebrar o carregamento da página quando um
// membro do time tem o calendário restrito ou DWD sem acesso.
export async function listCalendarEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  subject?: string,
) {
  const auth = getAuth(subject)
  if (!auth) return []
  try {
    const res = await google.calendar({ version: 'v3', auth }).events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    })
    return res.data.items ?? []
  } catch {
    return []
  }
}

// Listagem do calendário compartilhado padrão (retrocompatibilidade).
export async function listEvents(timeMin: string, timeMax: string) {
  return listCalendarEvents(CALENDAR_ID, timeMin, timeMax)
}

export async function createEvent(params: {
  title: string
  description?: string
  start: string
  end: string
  attendees?: string[]
  externalLink?: string
  location?: string        // local físico (ex: vara/comarca) — independente do externalLink
  organizerEmail?: string  // email do usuário que está criando — impersonado via DWD
  recurrence?: 'semanal' | 'mensal' | 'anual' | null
}): Promise<{ eventData: calendar_v3.Schema$Event; calendarId: string }> {
  const useMeet = !params.externalLink
  const rrule =
    params.recurrence === 'semanal'
      ? ['RRULE:FREQ=WEEKLY']
      : params.recurrence === 'mensal'
      ? ['RRULE:FREQ=MONTHLY']
      : params.recurrence === 'anual'
      ? ['RRULE:FREQ=YEARLY']
      : undefined
  const requestBody = {
    summary: params.title,
    description: params.description,
    location: params.location ?? params.externalLink,
    start: { dateTime: params.start, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: params.end,   timeZone: 'America/Sao_Paulo' },
    attendees: params.attendees?.map((email) => ({ email })),
    ...(rrule && { recurrence: rrule }),
    ...(useMeet && {
      conferenceData: {
        createRequest: {
          requestId: `crm-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }),
  }
  const insertOpts = {
    calendarId: CALENDAR_ID,
    conferenceDataVersion: useMeet ? 1 : 0,
    sendUpdates: (params.attendees?.length ? 'all' : 'none') as 'all' | 'none',
    requestBody,
  }

  // Só tenta DWD se o email está no mesmo domínio do Workspace configurado.
  const defaultSubject = process.env.GOOGLE_IMPERSONATE_EMAIL ?? ''
  const workspaceDomain = defaultSubject.split('@')[1]
  const userDomain = params.organizerEmail?.split('@')[1]
  const canImpersonate = !!(userDomain && workspaceDomain && userDomain === workspaceDomain)

  if (canImpersonate && params.organizerEmail) {
    const authUser = getAuth(params.organizerEmail)
    if (authUser) {
      try {
        // Cria no 'primary' do usuário — não no CALENDAR_ID (calendário de outro usuário,
        // onde o impersonado não tem permissão de escrita).
        const res = await google.calendar({ version: 'v3', auth: authUser }).events.insert({
          ...insertOpts,
          calendarId: 'primary',
        })
        return { eventData: res.data, calendarId: 'primary' }
      } catch {
        // Falha de DWD → fallback abaixo
      }
    }
  }

  // Fallback: organizer padrão, calendário compartilhado
  const auth = getAuth()
  if (!auth) throw new Error('Google Calendar não configurado')
  const res = await google.calendar({ version: 'v3', auth }).events.insert(insertOpts)
  return { eventData: res.data, calendarId: CALENDAR_ID }
}

// Atualiza parcialmente um evento existente via patch.
// Se subject fornecido, impersona o organizador via DWD para autenticar a operação.
export async function updateEvent(
  calendarId: string,
  eventId: string,
  params: {
    title: string
    description?: string
    start: string
    end: string
    attendees?: string[]
    externalLink?: string
  },
  subject?: string,
): Promise<calendar_v3.Schema$Event> {
  const auth = getAuth(subject)
  if (!auth) throw new Error('Google Calendar não configurado')

  const requestBody: calendar_v3.Schema$Event = {
    summary: params.title,
    description: params.description ?? '',
    location: params.externalLink ?? '',
    start: { dateTime: params.start, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: params.end,   timeZone: 'America/Sao_Paulo' },
    attendees: params.attendees?.map((email) => ({ email })),
  }

  const res = await google.calendar({ version: 'v3', auth }).events.patch({
    calendarId,
    eventId,
    sendUpdates: (params.attendees?.length ? 'all' : 'none') as 'all' | 'none',
    requestBody,
  })
  return res.data
}

export async function deleteEvent(calendarId: string, eventId: string, subject?: string) {
  const auth = getAuth(subject)
  if (!auth) throw new Error('Google Calendar não configurado')
  const cal = google.calendar({ version: 'v3', auth })
  await cal.events.delete({ calendarId, eventId })
}
