'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Video, Trash2, ExternalLink, Clock, Link as LinkIcon, Lock, Pencil, Cake, Users, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { excluirEvento, excluirBloqueio, salvarNota } from '@/app/(crm)/calendario/actions'
import type { Feriado } from '@/lib/feriados'
import { NovoEventoDialog } from '@/components/crm/calendario/novo-evento-dialog'
import type { EventoParaEditar } from '@/components/crm/calendario/novo-evento-dialog'
import { NovoBloqueioDialog } from '@/components/crm/calendario/novo-bloqueio-dialog'
import type { MembroInterno, NotaEvento } from '@/app/(crm)/calendario/page'
import type { Aniversario } from '@/lib/aniversarios'
import type { AgendaBloqueio } from '@/types'

type CalendarEvent = {
  id?: string | null
  summary?: string | null
  description?: string | null
  location?: string | null
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }> | null
  } | null
  htmlLink?: string | null
  organizer?: { email?: string | null } | null
  attendees?: Array<{ email?: string | null }> | null
}

interface SemanaViewProps {
  events: CalendarEvent[]
  weekDates: Date[]
  feriados: Feriado[]
  aniversarios: Array<Aniversario & { data: string }>
  membrosInternos: MembroInterno[]
  contatosExternos: string[]
  bloqueios: AgendaBloqueio[]
  notas: Record<string, NotaEvento>
  currentUserId: string
  currentUserEmail: string
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function getMeetLink(event: CalendarEvent) {
  return (
    event.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    )?.uri ?? null
  )
}

function formatarHorario(dateTimeStr?: string | null) {
  if (!dateTimeStr) return ''
  const d = new Date(dateTimeStr)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function formatarHorarioCompleto(startStr?: string | null, endStr?: string | null) {
  if (!startStr) return ''
  const start = new Date(startStr)
  const fmt = (d: Date) => {
    const dia = d.getDate().toString().padStart(2, '0')
    const mes = (d.getMonth() + 1).toString().padStart(2, '0')
    const h = d.getHours().toString().padStart(2, '0')
    const min = d.getMinutes().toString().padStart(2, '0')
    return `${dia}/${mes} às ${h}:${min}`
  }
  if (!endStr) return fmt(start)
  return `${fmt(start)} — ${formatarHorario(endStr)}`
}

function getEventosNoDia(events: CalendarEvent[], date: Date) {
  const ano = date.getFullYear()
  const mes = date.getMonth()
  const dia = date.getDate()

  return events.filter((ev) => {
    const dt = ev.start?.dateTime ?? ev.start?.date
    if (!dt) return false
    const d = new Date(dt)
    return d.getFullYear() === ano && d.getMonth() === mes && d.getDate() === dia
  })
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function getBloqueiosNoDia(bloqueios: AgendaBloqueio[], date: Date): AgendaBloqueio[] {
  const ano = date.getFullYear()
  const mes = (date.getMonth() + 1).toString().padStart(2, '0')
  const dia = date.getDate().toString().padStart(2, '0')
  const dateStr = `${ano}-${mes}-${dia}`
  return bloqueios.filter((b) => b.data === dateStr)
}

type DayItem =
  | { type: 'evento'; event: CalendarEvent }
  | { type: 'bloqueio'; bloqueio: AgendaBloqueio & { nomeUsuario?: string } }

function getHorarioItem(item: DayItem): string {
  if (item.type === 'evento') {
    const dt = item.event.start?.dateTime
    if (!dt) return ''
    const d = new Date(dt)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  return item.bloqueio.hora_inicio.substring(0, 5)
}

function BloqueioCard({
  bloqueio,
  onSelect,
}: {
  bloqueio: AgendaBloqueio & { nomeUsuario?: string }
  onSelect: (b: AgendaBloqueio & { nomeUsuario?: string }) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(bloqueio)}
      className="w-full rounded-lg bg-amber-500/15 px-2.5 py-2 text-left transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="truncate text-xs font-semibold leading-tight text-amber-700 dark:text-amber-400">
        {bloqueio.titulo}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <Lock className="size-2.5 text-amber-600 dark:text-amber-500" />
        <span className="font-mono text-[10px] text-amber-600 dark:text-amber-500">
          {bloqueio.hora_inicio.substring(0, 5)}–{bloqueio.hora_fim.substring(0, 5)}
        </span>
        {bloqueio.nomeUsuario && (
          <span className="truncate text-[10px] text-amber-600/70 dark:text-amber-500/70">
            {bloqueio.nomeUsuario}
          </span>
        )}
      </div>
    </button>
  )
}

function BloqueioDetailDialog({
  bloqueio,
  open,
  onClose,
  onDeleted,
  currentUserId,
}: {
  bloqueio: (AgendaBloqueio & { nomeUsuario?: string }) | null
  open: boolean
  onClose: () => void
  onDeleted: (id: string) => void
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()

  if (!bloqueio) return null

  const [ano, mesIdx, dia] = bloqueio.data.split('-').map(Number)
  const dataFormatada = `${dia.toString().padStart(2, '0')} de ${MESES[mesIdx - 1]} de ${ano}`
  const isOwn = bloqueio.user_id === currentUserId

  function handleExcluir() {
    const id = bloqueio!.id
    startTransition(async () => {
      const result = await excluirBloqueio(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Bloqueio removido')
      onDeleted(id)
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug flex items-center gap-2">
            <Lock className="size-4 text-amber-600 shrink-0" />
            {bloqueio.titulo}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" />
            <span>
              {dataFormatada} — {bloqueio.hora_inicio.substring(0, 5)} às {bloqueio.hora_fim.substring(0, 5)}
            </span>
          </div>

          {!isOwn && bloqueio.nomeUsuario && (
            <p className="text-xs text-muted-foreground">
              Bloqueado por: <span className="font-medium text-foreground">{bloqueio.nomeUsuario}</span>
            </p>
          )}

          {bloqueio.descricao && (
            <p className="whitespace-pre-wrap text-sm text-foreground">{bloqueio.descricao}</p>
          )}

          {isOwn && (
            <div className="flex justify-end border-t border-border pt-2">
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm" className="gap-2" disabled={isPending} />
                  }
                >
                  <Trash2 className="size-4" />
                  {isPending ? 'Removendo...' : 'Remover bloqueio'}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover bloqueio?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O bloqueio &ldquo;{bloqueio.titulo}&rdquo; sera removido do calendario.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleExcluir}
                      disabled={isPending}
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EventoCard({
  event,
  onSelect,
  isToday,
  organizerFirstName,
}: {
  event: CalendarEvent
  onSelect: (ev: CalendarEvent) => void
  isToday?: boolean
  organizerFirstName?: string
}) {
  const meetLink = getMeetLink(event)
  const hasLink = meetLink || event.location
  const horario = formatarHorario(event.start?.dateTime)

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        'w-full rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        hasLink
          ? 'bg-emerald-500/10 hover:bg-emerald-500/20'
          : isToday
          ? 'bg-primary/10 hover:bg-primary/15'
          : 'bg-muted/60 hover:bg-muted'
      )}
    >
      <p className={cn(
        'truncate text-xs font-semibold leading-tight',
        hasLink ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'
      )}>
        {event.summary ?? '(sem título)'}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        {horario && (
          <span className="flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground">
            <Clock className="size-2.5" />
            {horario}
          </span>
        )}
        {hasLink && (
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
            <Video className="size-2.5" />
            {meetLink ? 'Meet' : 'Link'}
          </span>
        )}
        {organizerFirstName && (
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
            <User className="size-2.5 shrink-0" />
            {organizerFirstName}
          </span>
        )}
      </div>
    </button>
  )
}

function EventoDetailDialog({
  event,
  open,
  onClose,
  onDeleted,
  onEditar,
  currentUserEmail,
  notaInicial,
  criadoPorNome,
}: {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
  onDeleted: (id: string) => void
  onEditar: (ev: CalendarEvent) => void
  currentUserEmail: string
  notaInicial?: NotaEvento
  criadoPorNome?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [notaTexto, setNotaTexto] = useState(notaInicial?.texto ?? '')
  const [salvandoNota, setSalvandoNota] = useState(false)

  useEffect(() => {
    setNotaTexto(notaInicial?.texto ?? '')
  }, [event?.id, notaInicial?.texto])

  if (!event) return null

  const meetLink = getMeetLink(event)
  const horario = formatarHorarioCompleto(event.start?.dateTime, event.end?.dateTime)
  const organizerEmail = event.organizer?.email ?? null
  const isOrganizer = !organizerEmail || organizerEmail === currentUserEmail

  const attendees = (event.attendees ?? [])
    .map((a) => a.email)
    .filter((e): e is string => !!e)

  function handleExcluir() {
    if (!event?.id) return
    const id = event.id
    startTransition(async () => {
      const result = await excluirEvento(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Evento excluído')
      onDeleted(id)
      onClose()
    })
  }

  async function handleSalvarNota() {
    if (!event?.id) return
    setSalvandoNota(true)
    const result = await salvarNota(event.id, event.summary ?? '', notaTexto)
    setSalvandoNota(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Observações salvas')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">
            {event.summary ?? '(sem título)'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-3 pt-1">
          {horario && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4 shrink-0" />
              <span>{horario}</span>
            </div>
          )}

          {criadoPorNome ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
              <User className="size-4 shrink-0 text-primary" />
              <span className="text-sm font-medium text-primary">
                Evento criado por {criadoPorNome}
              </span>
            </div>
          ) : organizerEmail ? (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Users className="size-4 shrink-0 mt-0.5" />
              <span className="min-w-0 break-all">Organizador: <span className="font-medium text-foreground">{organizerEmail}</span></span>
            </div>
          ) : null}

          {event.description && (
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {event.description}
            </p>
          )}

          {attendees.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">Participantes</p>
              <div className="flex flex-wrap gap-1">
                {attendees.map((email) => (
                  <Badge key={email} variant="secondary" className="text-xs whitespace-normal break-all max-w-full">
                    {email}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {meetLink && (
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 transition-colors hover:bg-green-500/20 dark:text-green-400"
            >
              <Video className="size-4 shrink-0" />
              Entrar no Google Meet
              <ExternalLink className="ml-auto size-3.5" />
            </a>
          )}

          {event.location && (
            <a
              href={event.location}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
            >
              <LinkIcon className="size-4 shrink-0" />
              Entrar na reunião externa
              <ExternalLink className="ml-auto size-3.5" />
            </a>
          )}

          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              <ExternalLink className="size-3" />
              Ver no Google Calendar
            </a>
          )}

          {/* Observações da equipe */}
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Label htmlFor="nota-evento" className="text-xs font-semibold text-foreground">
              Observações da equipe
            </Label>
            <Textarea
              id="nota-evento"
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Adicione observações sobre este evento — visível para toda a equipe..."
              rows={3}
              className="resize-none text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-end"
              onClick={handleSalvarNota}
              disabled={salvandoNota}
            >
              {salvandoNota ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { onClose(); onEditar(event) }}
            >
              <Pencil className="size-4" />
              Editar
            </Button>

            {isOrganizer && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm" className="gap-2" disabled={isPending} />
                  }
                >
                  <Trash2 className="size-4" />
                  {isPending ? 'Excluindo...' : 'Excluir'}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O evento será removido do Google Calendar permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleExcluir}
                      disabled={isPending}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SemanaView({
  events: initialEvents,
  weekDates,
  feriados,
  aniversarios,
  membrosInternos,
  contatosExternos,
  bloqueios: initialBloqueios,
  notas,
  currentUserId,
  currentUserEmail,
}: SemanaViewProps) {
  const [events, setEvents] = useState(initialEvents)
  const [bloqueios, setBloqueios] = useState(initialBloqueios)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedBloqueio, setSelectedBloqueio] = useState<(AgendaBloqueio & { nomeUsuario?: string }) | null>(null)
  const [novoEventoDate, setNovoEventoDate] = useState<string | undefined>()
  const [novoEventoOpen, setNovoEventoOpen] = useState(false)
  const [novoBloqueioDate, setNovoBloqueioDate] = useState<string | undefined>()
  const [novoBloqueioOpen, setNovoBloqueioOpen] = useState(false)
  const [eventoParaEditar, setEventoParaEditar] = useState<EventoParaEditar | undefined>()
  const [modoEdicao, setModoEdicao] = useState(false)

  function abrirNovoEvento(dateStr: string) {
    setEventoParaEditar(undefined)
    setModoEdicao(false)
    setNovoEventoDate(dateStr)
    setNovoEventoOpen(true)
  }

  function abrirEdicao(ev: CalendarEvent) {
    if (!ev.id) return
    const attendees = (ev.attendees ?? [])
      .map((a) => a.email)
      .filter((e): e is string => !!e)
    setEventoParaEditar({
      id: ev.id,
      titulo: ev.summary ?? '',
      descricao: ev.description ?? undefined,
      start: ev.start?.dateTime ?? '',
      end: ev.end?.dateTime ?? '',
      attendees,
      externalLink: ev.location ?? undefined,
      organizerEmail: ev.organizer?.email ?? undefined,
    })
    setModoEdicao(true)
    setNovoEventoDate(undefined)
    setNovoEventoOpen(true)
  }

  const emailToFirstName = Object.fromEntries(
    membrosInternos.map((m) => [m.email, m.nome.split(' ')[0]])
  )

  const hoje = new Date()
  const hojeAno = hoje.getFullYear()
  const hojeM = hoje.getMonth()
  const hojeDia = hoje.getDate()

  function isHoje(date: Date) {
    return (
      date.getFullYear() === hojeAno &&
      date.getMonth() === hojeM &&
      date.getDate() === hojeDia
    )
  }

  function handleEventoExcluido(id: string) {
    setEvents((prev) => prev.filter((ev) => ev.id !== id))
  }

  function handleBloqueioExcluido(id: string) {
    setBloqueios((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5">
        {weekDates.map((date, idx) => {
          const eventosNoDia = getEventosNoDia(events, date)
          const bloqueiosNoDia = getBloqueiosNoDia(bloqueios, date)
          const ehHoje = isHoje(date)
          const diaNum = date.getDate().toString().padStart(2, '0')
          const mesNum = (date.getMonth() + 1).toString().padStart(2, '0')

          const dateStr = `${date.getFullYear()}-${mesNum}-${diaNum}`
          const feriado = feriados.find((f) => f.data === dateStr)
          const aniversario = aniversarios.find((a) => a.data === dateStr)

          return (
            <div
              key={idx}
              className={cn(
                'flex flex-col gap-1.5 rounded-xl p-1',
                ehHoje && 'bg-primary/[0.04] ring-1 ring-primary/20'
              )}
            >
              {/* Cabeçalho do dia — clicável para novo evento */}
              {ehHoje ? (
                <button
                  type="button"
                  onClick={() => abrirNovoEvento(dateStr)}
                  className="flex w-full flex-col items-center rounded-lg bg-primary px-1 py-3 transition-opacity hover:opacity-90"
                  title="Novo evento neste dia"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60">
                    {DIAS_SEMANA[date.getDay()]}
                  </span>
                  <span className="mt-1 text-2xl font-bold leading-none text-primary-foreground">
                    {diaNum}
                  </span>
                  <span className="mt-1.5 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Hoje
                  </span>
                </button>
              ) : feriado ? (
                <button
                  type="button"
                  onClick={() => abrirNovoEvento(dateStr)}
                  className="flex w-full flex-col items-center rounded-lg bg-red-50 px-1 py-3 transition-colors hover:bg-red-100"
                  title="Novo evento neste dia"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                    {DIAS_SEMANA[date.getDay()]}
                  </span>
                  <span className="mt-1 text-xl font-bold leading-none text-red-600">
                    {diaNum}
                  </span>
                  <span className="mt-1 max-w-full truncate px-0.5 text-center text-[9px] font-medium leading-tight text-red-500">
                    {feriado.nome}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => abrirNovoEvento(dateStr)}
                  className="flex w-full flex-col items-center rounded-lg bg-muted/40 px-1 py-3 transition-colors hover:bg-muted"
                  title="Novo evento neste dia"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {DIAS_SEMANA[date.getDay()]}
                  </span>
                  <span className="mt-1 text-xl font-bold leading-none text-foreground">
                    {diaNum}
                  </span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{mesNum}</span>
                </button>
              )}

              {/* Indicador de aniversário */}
              {aniversario && (
                <div className="flex items-center justify-center gap-1 rounded-md bg-purple-50 px-1 py-1 dark:bg-purple-950/30">
                  <Cake className="size-3 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-[9px] font-medium text-purple-600 dark:text-purple-400 truncate leading-tight">
                    {aniversario.nome}
                  </span>
                </div>
              )}

              {/* Bloqueios e eventos misturados, ordenados por horário */}
              {(() => {
                const allItems: DayItem[] = [
                  ...eventosNoDia.map((ev) => ({ type: 'evento' as const, event: ev })),
                  ...bloqueiosNoDia.map((b) => ({ type: 'bloqueio' as const, bloqueio: b as AgendaBloqueio & { nomeUsuario?: string } })),
                ].sort((a, b) => getHorarioItem(a).localeCompare(getHorarioItem(b)))

                if (allItems.length === 0) {
                  return (
                    <div className={cn(
                      'rounded-lg px-2 py-4 text-center',
                      ehHoje ? 'border border-dashed border-primary/20' : 'border border-dashed border-border'
                    )}>
                      <p className="text-[10px] text-muted-foreground">Sem eventos</p>
                    </div>
                  )
                }

                return (
                  <div className="flex flex-col gap-1">
                    {allItems.map((item) =>
                      item.type === 'bloqueio' ? (
                        <BloqueioCard key={item.bloqueio.id} bloqueio={item.bloqueio} onSelect={setSelectedBloqueio} />
                      ) : (
                        <EventoCard
                          key={item.event.id}
                          event={item.event}
                          onSelect={setSelectedEvent}
                          isToday={ehHoje}
                          organizerFirstName={item.event.organizer?.email ? emailToFirstName[item.event.organizer.email] : undefined}
                        />
                      )
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      <EventoDetailDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDeleted={handleEventoExcluido}
        onEditar={abrirEdicao}
        currentUserEmail={currentUserEmail}
        notaInicial={selectedEvent?.id ? notas[selectedEvent.id] : undefined}
        criadoPorNome={selectedEvent?.organizer?.email ? emailToFirstName[selectedEvent.organizer.email] : undefined}
      />

      <BloqueioDetailDialog
        bloqueio={selectedBloqueio}
        open={!!selectedBloqueio}
        onClose={() => setSelectedBloqueio(null)}
        onDeleted={handleBloqueioExcluido}
        currentUserId={currentUserId}
      />

      <NovoEventoDialog
        membrosInternos={membrosInternos}
        contatosExternos={contatosExternos}
        defaultDate={novoEventoDate}
        open={novoEventoOpen}
        onOpenChange={(v) => {
          setNovoEventoOpen(v)
          if (!v) {
            setModoEdicao(false)
            setEventoParaEditar(undefined)
          }
        }}
        modoEdicao={modoEdicao}
        eventoParaEditar={eventoParaEditar}
      />

      <NovoBloqueioDialog
        defaultDate={novoBloqueioDate}
        open={novoBloqueioOpen}
        onOpenChange={setNovoBloqueioOpen}
      />
    </>
  )
}
