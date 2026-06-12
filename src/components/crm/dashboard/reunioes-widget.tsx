import Link from 'next/link'
import { Video, CalendarDays, ExternalLink, Link as LinkIcon } from 'lucide-react'

type CalendarEvent = {
  id?: string | null
  summary?: string | null
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }> | null
  } | null
  location?: string | null
}

interface Props {
  hoje: CalendarEvent[]
  amanha: CalendarEvent[]
}

function getMeetLink(event: CalendarEvent) {
  return event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ?? null
}

function formatarHorario(dateTimeStr?: string | null) {
  if (!dateTimeStr) return ''
  const d = new Date(dateTimeStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function EventoRow({ event }: { event: CalendarEvent }) {
  const meetLink = getMeetLink(event)
  const linkExterno = event.location
  const horario = formatarHorario(event.start?.dateTime)
  const link = meetLink ?? linkExterno

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">
          {event.summary ?? '(sem título)'}
        </p>
        {horario && (
          <p className="text-xs text-muted-foreground">{horario}</p>
        )}
      </div>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-green-500/10 px-2.5 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-500/20"
        >
          {meetLink ? <Video className="size-3.5" /> : <LinkIcon className="size-3.5" />}
          Entrar
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  )
}

export function ReunioesWidget({ hoje, amanha }: Props) {
  if (hoje.length === 0 && amanha.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <CalendarDays className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Reuniões</h3>
        <Link
          href="/calendario"
          className="ml-auto text-xs font-medium text-primary hover:underline"
        >
          Ver calendário
        </Link>
      </div>

      <div className="divide-y divide-border px-5">
        {hoje.length > 0 && (
          <div className="py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hoje
            </p>
            {hoje.map((ev) => (
              <EventoRow key={ev.id} event={ev} />
            ))}
          </div>
        )}

        {amanha.length > 0 && (
          <div className="py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Amanhã
            </p>
            {amanha.map((ev) => (
              <EventoRow key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
