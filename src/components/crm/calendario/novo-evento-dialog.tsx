'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarPlus, Link as LinkIcon, Video, X, Users, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { criarEvento, editarEvento } from '@/app/(crm)/calendario/actions'
import type { MembroInterno } from '@/app/(crm)/calendario/page'

// Gera todos os horários de 5 em 5 minutos: 00:00, 00:05, ... 23:55
const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = Math.floor(i / 12).toString().padStart(2, '0')
  const m = ((i % 12) * 5).toString().padStart(2, '0')
  return `${h}:${m}`
})

function TimeSelect({
  value,
  onChange,
  id,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  id: string
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={!disabled}
      disabled={disabled}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <option value="" disabled>HH:MM</option>
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const newH = (h + 1) % 24
  return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function snapTo5Minutes(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const snapped = Math.round(m / 5) * 5
  if (snapped === 60) {
    const newH = (h + 1) % 24
    return `${newH.toString().padStart(2, '0')}:00`
  }
  return `${h.toString().padStart(2, '0')}:${snapped.toString().padStart(2, '0')}`
}

// Extrai "HH:MM" de uma string ISO datetime
function isoToTimeStr(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// Extrai "YYYY-MM-DD" de uma string ISO datetime (sem usar toISOString para evitar drift de timezone)
function isoToDateStr(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface EventoParaEditar {
  id: string
  titulo: string
  descricao?: string
  start: string   // ISO datetime
  end: string     // ISO datetime
  attendees?: string[]
  externalLink?: string
  organizerEmail?: string
}

interface Props {
  membrosInternos: MembroInterno[]
  contatosExternos: string[]
  defaultDate?: string          // YYYY-MM-DD — pré-preenche a data ao abrir
  open?: boolean                // modo controlado externamente
  onOpenChange?: (v: boolean) => void
  // Props de edição
  modoEdicao?: boolean
  eventoParaEditar?: EventoParaEditar
}

export function NovoEventoDialog({
  membrosInternos,
  contatosExternos,
  defaultDate,
  open: openProp,
  onOpenChange,
  modoEdicao = false,
  eventoParaEditar,
}: Props) {
  const isControlled = openProp !== undefined
  const [openInternal, setOpenInternal] = useState(false)
  const open = isControlled ? openProp : openInternal

  function setOpen(v: boolean) {
    if (isControlled) onOpenChange?.(v)
    else setOpenInternal(v)
  }

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [meetLinkCriado, setMeetLinkCriado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [externalLink, setExternalLink] = useState('')
  const [diaTodo, setDiaTodo] = useState(false)
  const [recurrence, setRecurrence] = useState<string>('none')
  const [visivelEquipe, setVisivelEquipe] = useState(false)

  // Valores anteriores para comparação de diff na edição
  const [tituloAnterior, setTituloAnterior] = useState('')
  const [horarioInicioAnterior, setHorarioInicioAnterior] = useState('')
  const [horarioFimAnterior, setHorarioFimAnterior] = useState('')
  const [descricaoAnterior, setDescricaoAnterior] = useState('')
  const [attendeesAnterior, setAttendeesAnterior] = useState('')

  // Seleção de membros internos
  const [selectedInternos, setSelectedInternos] = useState<Set<string>>(new Set())

  // E-mails externos adicionados manualmente
  const [externosAdicionados, setExternosAdicionados] = useState<string[]>([])
  const [externoInput, setExternoInput] = useState('')
  const externoInputRef = useRef<HTMLInputElement>(null)

  // Preencher formulário ao abrir (criação: defaultDate; edição: dados do evento)
  useEffect(() => {
    if (!open) return

    if (modoEdicao && eventoParaEditar) {
      const dateStr = isoToDateStr(eventoParaEditar.start)
      const timeIni = isoToTimeStr(eventoParaEditar.start)
      const timeFim = isoToTimeStr(eventoParaEditar.end)
      const endDateStr = isoToDateStr(eventoParaEditar.end)

      setTitle(eventoParaEditar.titulo)
      setDescription(eventoParaEditar.descricao ?? '')
      setStartDate(dateStr)
      setStartTime(timeIni)
      setEndDate(endDateStr)
      setEndTime(timeFim)
      setExternalLink(eventoParaEditar.externalLink ?? '')

      // Guardar valores anteriores para detectar diffs
      setTituloAnterior(eventoParaEditar.titulo)
      setHorarioInicioAnterior(eventoParaEditar.start)
      setHorarioFimAnterior(eventoParaEditar.end)
      setDescricaoAnterior(eventoParaEditar.descricao ?? '')

      // Separar internos de externos
      const emailsInternos = new Set(membrosInternos.map((m) => m.email))
      const internos = new Set<string>()
      const externos: string[] = []
      for (const email of eventoParaEditar.attendees ?? []) {
        if (emailsInternos.has(email)) internos.add(email)
        else externos.push(email)
      }
      setSelectedInternos(internos)
      setExternosAdicionados(externos)
      setAttendeesAnterior((eventoParaEditar.attendees ?? []).slice().sort().join(','))
    } else if (!modoEdicao && defaultDate) {
      setStartDate(defaultDate)
      setEndDate(defaultDate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Dia todo: fixar horários e ocultar selects
  useEffect(() => {
    if (diaTodo) {
      setStartTime('09:00')
      setEndTime('17:00')
    }
  }, [diaTodo])

  function toggleMembro(email: string) {
    setSelectedInternos((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  function selecionarTodos() {
    if (selectedInternos.size === membrosInternos.length) {
      setSelectedInternos(new Set())
    } else {
      setSelectedInternos(new Set(membrosInternos.map((m) => m.email)))
    }
  }

  function adicionarExterno() {
    const email = externoInput.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    if (!externosAdicionados.includes(email)) {
      setExternosAdicionados((prev) => [...prev, email])
    }
    setExternoInput('')
    externoInputRef.current?.focus()
  }

  function removerExterno(email: string) {
    setExternosAdicionados((prev) => prev.filter((e) => e !== email))
  }

  function handleStartDateChange(val: string) {
    setStartDate(val)
    setEndDate(val)
  }

  function handleStartTimeChange(val: string) {
    const snapped = snapTo5Minutes(val)
    setStartTime(snapped)
    setEndTime(addOneHour(snapped))
    if (!endDate && startDate) setEndDate(startDate)
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setStartDate('')
    setStartTime('')
    setEndDate('')
    setEndTime('')
    setExternalLink('')
    setDiaTodo(false)
    setRecurrence('none')
    setVisivelEquipe(false)
    setSelectedInternos(new Set())
    setExternosAdicionados([])
    setExternoInput('')
    setMeetLinkCriado(null)
    setCopiado(false)
    setTituloAnterior('')
    setHorarioInicioAnterior('')
    setHorarioFimAnterior('')
    setDescricaoAnterior('')
    setAttendeesAnterior('')
  }

  function copiarLink(link: string) {
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!startDate || !startTime || !endDate || !endTime) {
      toast.error('Preencha data e hora de início e fim')
      return
    }

    const todosConvidados = [
      ...Array.from(selectedInternos),
      ...externosAdicionados,
    ]

    const payload = new FormData()
    payload.set('title', title)
    payload.set('description', description)
    payload.set('start', `${startDate}T${startTime}:00`)
    payload.set('end', `${endDate}T${endTime}:00`)
    payload.set('attendees', todosConvidados.join(','))
    payload.set('external_link', externalLink)
    payload.set('recurrence', recurrence === 'none' ? '' : recurrence)
    if (!modoEdicao) {
      payload.set('visivel_equipe', String(visivelEquipe))
    }

    if (modoEdicao && eventoParaEditar) {
      // Campos para detecção de diff
      payload.set('titulo_anterior', tituloAnterior)
      payload.set('horario_inicio_anterior', horarioInicioAnterior)
      payload.set('horario_fim_anterior', horarioFimAnterior)
      payload.set('descricao_anterior', descricaoAnterior)
      payload.set('attendees_anterior', attendeesAnterior)

      startTransition(async () => {
        const result = await editarEvento(eventoParaEditar.id, payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Evento atualizado com sucesso')
        resetForm()
        setOpen(false)
        router.refresh()
      })
      return
    }

    startTransition(async () => {
      const result = await criarEvento(payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.meetLink) {
        setMeetLinkCriado(result.meetLink)
      } else {
        toast.success('Evento criado com sucesso')
        resetForm()
        setOpen(false)
        router.refresh()
      }
    })
  }

  const todosSelected = membrosInternos.length > 0 && selectedInternos.size === membrosInternos.length

  return (
    <>
      {!isControlled && (
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <CalendarPlus className="size-4" />
          Novo Evento
        </Button>
      )}

      {/* Dialog pós-criação: link Meet copiável */}
      <Dialog open={!!meetLinkCriado} onOpenChange={(v) => { if (!v) { setMeetLinkCriado(null); resetForm(); setOpen(false); router.refresh() } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="size-5 text-green-600" />
              Evento criado com sucesso
            </DialogTitle>
            <DialogDescription>
              O convite foi enviado para os participantes. Copie o link abaixo para compartilhar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <span className="flex-1 truncate font-mono text-xs text-foreground">
                {meetLinkCriado}
              </span>
              <button
                type="button"
                onClick={() => meetLinkCriado && copiarLink(meetLinkCriado)}
                className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-accent"
                title="Copiar link"
              >
                {copiado
                  ? <Check className="size-4 text-green-600" />
                  : <Copy className="size-4 text-muted-foreground" />
                }
              </button>
            </div>
            <div className="flex gap-2">
              <a
                href={meetLinkCriado ?? ''}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500/10 px-4 py-2.5 text-sm font-medium text-green-600 transition-colors hover:bg-green-500/20"
              >
                <Video className="size-4" />
                Entrar agora
                <ExternalLink className="size-3.5" />
              </a>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setMeetLinkCriado(null); resetForm(); setOpen(false); router.refresh() }}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modoEdicao ? 'Editar evento' : 'Novo Evento com Meet'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">

            {/* Título */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Reunião de alinhamento..."
                required
              />
            </div>

            {/* Descrição */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Pauta, contexto ou observações..."
                rows={2}
              />
            </div>

            {/* Toggle: Dia todo */}
            <div className="flex items-center gap-3">
              <Switch
                id="dia_todo"
                checked={diaTodo}
                onCheckedChange={setDiaTodo}
              />
              <Label htmlFor="dia_todo" className="cursor-pointer select-none">
                Dia todo
              </Label>
            </div>

            {/* Toggle: Visível para a equipe (só na criação — visibilidade não é editável) */}
            {!modoEdicao && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <Switch
                    id="visivel_equipe"
                    checked={visivelEquipe}
                    onCheckedChange={setVisivelEquipe}
                  />
                  <Label htmlFor="visivel_equipe" className="cursor-pointer select-none">
                    Visível para a equipe
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Por padrão só você vê este evento. Ative para toda a equipe ver.
                </p>
              </div>
            )}

            {/* Data/hora início */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start_date">
                  Data início <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  required
                />
              </div>
              {!diaTodo && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start_time">
                    Hora início <span className="text-destructive">*</span>
                  </Label>
                  <TimeSelect
                    id="start_time"
                    value={startTime}
                    onChange={handleStartTimeChange}
                  />
                </div>
              )}
            </div>

            {/* Data/hora fim */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end_date">
                  Data fim <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
              {!diaTodo && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="end_time">
                    Hora fim <span className="text-destructive">*</span>
                  </Label>
                  <TimeSelect
                    id="end_time"
                    value={endTime}
                    onChange={setEndTime}
                  />
                </div>
              )}
            </div>

            {/* Link externo */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="external_link">Link de reunião externo</Label>
              {/* type="text" intencional: type="url" rejeita URLs sem protocolo explícito
                  (ex: zoom.us/j/123) e não agrega validação útil aqui pois o campo é opcional. */}
              <Input
                id="external_link"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="https://zoom.us/j/... Teams, Meet de terceiros..."
                type="text"
              />
              {externalLink ? (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <LinkIcon className="size-3" />
                  Link externo detectado — Google Meet não será gerado
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Video className="size-3" />
                  Deixe vazio para gerar Google Meet automaticamente
                </p>
              )}
            </div>

            {/* Recorrência — só na criação: editar a recorrência de um evento
                já existente não é suportado (repetir também precisa de Google
                conectado — sem isso o evento fica só no CRM, sem série). */}
            {!modoEdicao && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recurrence">Repetição</Label>
                <select
                  id="recurrence"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="none">Não repetir</option>
                  <option value="semanal">Semanalmente</option>
                  <option value="mensal">Mensalmente</option>
                  <option value="anual">Anualmente</option>
                </select>
                {recurrence !== 'none' && (
                  <p className="text-xs text-muted-foreground">
                    A repetição fica só na sua agenda do Google — aqui no CRM só a primeira ocorrência aparece.
                  </p>
                )}
              </div>
            )}

            {/* Membros internos */}
            {membrosInternos.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    Compartilhar com a equipe
                  </Label>
                  <button
                    type="button"
                    onClick={selecionarTodos}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {todosSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {membrosInternos.map((m) => {
                    const selecionado = selectedInternos.has(m.email)
                    return (
                      <button
                        key={m.email}
                        type="button"
                        onClick={() => toggleMembro(m.email)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          selecionado
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-foreground hover:border-primary/50'
                        )}
                      >
                        {m.nome}
                      </button>
                    )
                  })}
                </div>
                {selectedInternos.size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedInternos.size} membro{selectedInternos.size > 1 ? 's' : ''} selecionado{selectedInternos.size > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* E-mails externos */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="externo_input">Convidados externos</Label>
              <div className="flex gap-2">
                <Input
                  id="externo_input"
                  ref={externoInputRef}
                  value={externoInput}
                  onChange={(e) => setExternoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); adicionarExterno() }
                  }}
                  placeholder="email@empresa.com"
                  list="contatos-externos-list"
                  type="email"
                />
                <Button type="button" variant="outline" size="sm" onClick={adicionarExterno}>
                  Adicionar
                </Button>
              </div>
              {contatosExternos.length > 0 && (
                <datalist id="contatos-externos-list">
                  {contatosExternos.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              )}
              {externosAdicionados.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {externosAdicionados.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1 pr-1">
                      {email}
                      <button
                        type="button"
                        onClick={() => removerExterno(email)}
                        className="ml-0.5 rounded-full hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Pressione Enter ou clique em Adicionar. E-mails novos são salvos automaticamente.
              </p>
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setOpen(false); resetForm() }}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending
                  ? (modoEdicao ? 'Salvando...' : 'Criando...')
                  : (modoEdicao ? 'Salvar alterações' : 'Criar evento com Meet')
                }
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
