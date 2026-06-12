'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Video, Trash2, ExternalLink, Clock, Link as LinkIcon, CalendarPlus, Lock, Pencil, Cake, Users, User } from 'lucide-react'
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

const DIAS_HEADER = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function getMeetLink(event: CalendarEvent) {
  return event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ?? null
}

function formatarHorario(dateTimeStr?: string | null) {
  if (!dateTimeStr) return ''
  const d = new Date(dateTimeStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getEventosNoDia(events: CalendarEvent[], dateStr: string) {
  const [ano, mes, dia] = dateStr.split('-').map(Number)
  return events.filter((ev) => {
    const dt = ev.start?.dateTime ?? ev.start?.date
    if (!dt) return false
    const d = new Date(dt)
    return d.getFullYear() === ano && d.getMonth() + 1 === mes && d.getDate() === dia
  })
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
      if (result.error) { toast.error(result.error); return }
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
          <DialogTitle className="pr-6 leading-snug">{event.summary ?? '(sem título)'}</DialogTitle>
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
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">{event.description}</p>
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
            <a href={meetLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 transition-colors hover:bg-green-500/20 dark:text-green-400">
              <Video className="size-4 shrink-0" />
              Entrar no Google Meet
              <ExternalLink className="ml-auto size-3.5" />
            </a>
          )}
          {event.location && (
            <a href={event.location} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400">
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
            <Label htmlFor="nota-evento-mes" className="text-xs font-semibold text-foreground">
              Observações da equipe
            </Label>
            <Textarea
              id="nota-evento-mes"
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
                  render={<Button variant="destructive" size="sm" className="gap-2" disabled={isPending} />}
                >
                  <Trash2 className="size-4" />
                  {isPending ? 'Excluindo...' : 'Excluir'}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
                    <AlertDialogDescription>O evento será removido do Google Calendar permanentemente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleExcluir} disabled={isPending}>Excluir</AlertDialogAction>
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

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function getBloqueiosNoDia(bloqueios: AgendaBloqueio[], dateStr: string): AgendaBloqueio[] {
  return bloqueios.filter((b) => b.data === dateStr)
}

function BloqueioMiniCard({
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
      className="w-full truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-left text-[10px] font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
    >
      <Lock className="mr-0.5 inline size-2.5 opacity-70" />
      {bloqueio.nomeUsuario ? `${bloqueio.nomeUsuario}: ` : ''}{bloqueio.titulo}
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
      if (result.error) { toast.error(result.error); return }
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
                  render={<Button variant="destructive" size="sm" className="gap-2" disabled={isPending} />}
                >
                  <Trash2 className="size-4" />
                  {isPending ? 'Removendo...' : 'Remover bloqueio'}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover bloqueio?</AlertDialogTitle>
                    <AlertDialogDescription>O bloqueio &ldquo;{bloqueio.titulo}&rdquo; sera removido do calendario.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleExcluir} disabled={isPending}>Remover</AlertDialogAction>
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

interface MesViewProps {
  events: CalendarEvent[]
  ano: number
  mes: number   // 0-indexed
  feriados: Feriado[]
  aniversarios: Array<Aniversario & { data: string }>
  membrosInternos: MembroInterno[]
  contatosExternos: string[]
  bloqueios: AgendaBloqueio[]
  notas: Record<string, NotaEvento>
  currentUserId: string
  currentUserEmail: string
}

export function MesView({
  events: initialEvents,
  ano,
  mes,
  feriados,
  aniversarios,
  membrosInternos,
  contatosExternos,
  bloqueios: initialBloqueios,
  notas,
  currentUserId,
  currentUserEmail,
}: MesViewProps) {
  const [events, setEvents] = useState(initialEvents)
  const [bloqueios, setBloqueios] = useState(initialBloqueios)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedBloqueio, setSelectedBloqueio] = useState<(AgendaBloqueio & { nomeUsuario?: string }) | null>(null)
  const [novoEventoDate, setNovoEventoDate] = useState<string | undefined>()
  const [novoEventoOpen, setNovoEventoOpen] = useState(false)
  const [eventoParaEditar, setEventoParaEditar] = useState<EventoParaEditar | undefined>()
  const [modoEdicao, setModoEdicao] = useState(false)

  const emailToFirstName = Object.fromEntries(
    membrosInternos.map((m) => [m.email, m.nome.split(' ')[0]])
  )

  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}-${hoje.getDate().toString().padStart(2, '0')}`

  // Gerar grid do mês: começa no domingo da semana do dia 1
  const primeiroDia = new Date(ano, mes, 1)
  const inicioDaGrade = new Date(primeiroDia)
  inicioDaGrade.setDate(1 - primeiroDia.getDay())

  const dias: string[] = []
  const d = new Date(inicioDaGrade)
  while (dias.length < 42) {
    const str = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
    dias.push(str)
    d.setDate(d.getDate() + 1)
  }

  // Cortar última linha se já pertence toda ao próximo mês.
  const cortar6aLinha = (() => {
    if (!dias[35]) return false
    const d35 = new Date(dias[35])
    const mesD35 = d35.getMonth()
    const anoD35 = d35.getFullYear()
    return (
      anoD35 > ano ||
      (anoD35 === ano && mesD35 > mes)
    )
  })()
  const grid = dias.slice(0, cortar6aLinha ? 35 : 42)

  function handleEventoExcluido(id: string) {
    setEvents((prev) => prev.filter((ev) => ev.id !== id))
  }

  function handleBloqueioExcluido(id: string) {
    setBloqueios((prev) => prev.filter((b) => b.id !== id))
  }

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

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        {/* Header dias da semana */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {DIAS_HEADER.map((dia) => (
            <div key={dia} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {dia}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {grid.map((dateStr) => {
            const [y, m] = dateStr.split('-').map(Number)
            const diaNum = parseInt(dateStr.split('-')[2], 10)
            const mesAtual = m - 1 === mes && y === ano
            const isHoje = dateStr === hojeStr
            const eventosNoDia = getEventosNoDia(events, dateStr)
            const feriado = feriados.find((f) => f.data === dateStr)
            const aniversario = aniversarios.find((a) => a.data === dateStr)

            return (
              <div
                key={dateStr}
                className={cn(
                  'group min-h-[96px] p-1.5',
                  !mesAtual && 'bg-muted/20',
                  feriado?.tipo === 'nacional'  && mesAtual && 'bg-red-50/60',
                  feriado?.tipo === 'estadual'  && mesAtual && 'bg-amber-50/60',
                  feriado?.tipo === 'municipal' && mesAtual && 'bg-blue-50/60',
                )}
              >
                {/* Número do dia — clicável para criar novo evento (apenas dias do mês atual) */}
                <div className="mb-1.5 flex items-center justify-between">
                  {mesAtual ? (
                    <button
                      type="button"
                      onClick={() => abrirNovoEvento(dateStr)}
                      title="Novo evento neste dia"
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                        isHoje
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      {diaNum}
                    </button>
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-muted-foreground/40">
                      {diaNum}
                    </span>
                  )}
                  {mesAtual && (
                    <button
                      type="button"
                      onClick={() => abrirNovoEvento(dateStr)}
                      title="Novo evento neste dia"
                      className="invisible rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground group-hover:visible"
                    >
                      <CalendarPlus className="size-3" />
                    </button>
                  )}
                </div>

                {/* Badge de feriado — nome completo, largura total */}
                {feriado && mesAtual && (
                  <div className={cn(
                    'mb-1.5 w-full rounded-md px-1.5 py-1 text-[11px] font-semibold leading-tight',
                    feriado.tipo === 'nacional'  && 'bg-red-100 text-red-700 ring-1 ring-red-200',
                    feriado.tipo === 'estadual'  && 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
                    feriado.tipo === 'municipal' && 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
                  )}>
                    {feriado.nome}
                  </div>
                )}

                {/* Indicador de aniversário */}
                {aniversario && mesAtual && (
                  <div className="mb-1.5 flex items-center gap-1 rounded-md bg-purple-100 px-1.5 py-1 ring-1 ring-purple-200 dark:bg-purple-950/40 dark:ring-purple-800">
                    <Cake className="size-2.5 shrink-0 text-purple-600 dark:text-purple-400" />
                    <span className="truncate text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                      {aniversario.nome}
                    </span>
                  </div>
                )}

                {(() => {
                  const bloqueiosNoDia = getBloqueiosNoDia(bloqueios, dateStr)
                  type MesItem =
                    | { type: 'evento'; event: CalendarEvent; hora: string }
                    | { type: 'bloqueio'; bloqueio: AgendaBloqueio & { nomeUsuario?: string }; hora: string }
                  const allItems: MesItem[] = [
                    ...eventosNoDia.map((ev) => ({
                      type: 'evento' as const,
                      event: ev,
                      hora: formatarHorario(ev.start?.dateTime),
                    })),
                    ...bloqueiosNoDia.map((b) => ({
                      type: 'bloqueio' as const,
                      bloqueio: b as AgendaBloqueio & { nomeUsuario?: string },
                      hora: b.hora_inicio.substring(0, 5),
                    })),
                  ].sort((a, b) => a.hora.localeCompare(b.hora))

                  const visiveis = allItems.slice(0, 3)
                  const extras = allItems.length - visiveis.length

                  return (
                    <div className="flex flex-col gap-0.5">
                      {visiveis.map((item) => {
                        if (item.type === 'bloqueio') {
                          return <BloqueioMiniCard key={item.bloqueio.id} bloqueio={item.bloqueio} onSelect={setSelectedBloqueio} />
                        }
                        const ev = item.event
                        const meetLink = getMeetLink(ev)
                        const criador = ev.organizer?.email ? emailToFirstName[ev.organizer.email] : undefined
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => setSelectedEvent(ev)}
                            className="flex w-full items-center gap-0.5 truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[10px] font-medium text-primary hover:bg-primary/20"
                          >
                            {item.hora && <span className="shrink-0 opacity-70">{item.hora}</span>}
                            <span className="min-w-0 truncate">{ev.summary ?? '(sem título)'}</span>
                            {(meetLink || ev.location) && <Video className="ml-0.5 size-2.5 shrink-0 opacity-60" />}
                            {criador && <span className="ml-auto shrink-0 text-[9px] text-primary/60">{criador}</span>}
                          </button>
                        )
                      })}
                      {extras > 0 && (
                        <span className="px-1 text-[10px] text-muted-foreground">+{extras} mais</span>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda feriados e aniversários */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
          Feriado nacional
        </span>
        <span className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
          Feriado estadual (BA)
        </span>
        <span className="flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
          Feriado municipal (Salvador)
        </span>
        <span className="flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-200">
          <Cake className="size-3" />
          Aniversário
        </span>
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
    </>
  )
}
