'use client'

import { useState, useTransition } from 'react'
import {
  Phone,
  Mail,
  Users,
  FileText,
  StickyNote,
  Bell,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { getLinhaTempoNegocio } from '@/app/(crm)/pipeline/linha-tempo-actions'
import type { EventoLinhaTempo, EventoTipo } from '@/app/(crm)/pipeline/linha-tempo-actions'
import { cn } from '@/lib/utils'

// ─── Config visual por tipo ───────────────────────────────────────────────────

interface TipoConfig {
  label: string
  Icon: React.ElementType
  iconClass: string
  dotClass: string
  badgeClass: string
}

const TIPO_CONFIG: Record<EventoTipo, TipoConfig> = {
  criado: {
    label: 'Criado',
    Icon: Plus,
    iconClass: 'text-slate-600',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  ligacao: {
    label: 'Ligação',
    Icon: Phone,
    iconClass: 'text-emerald-600',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  email: {
    label: 'E-mail',
    Icon: Mail,
    iconClass: 'text-blue-600',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  reuniao: {
    label: 'Reunião',
    Icon: Users,
    iconClass: 'text-violet-600',
    dotClass: 'bg-violet-500',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
  proposta: {
    label: 'Proposta',
    Icon: FileText,
    iconClass: 'text-amber-600',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  nota: {
    label: 'Nota',
    Icon: StickyNote,
    iconClass: 'text-slate-600',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  lembrete: {
    label: 'Lembrete',
    Icon: Bell,
    iconClass: 'text-amber-500',
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  fechado: {
    label: 'Fechado',
    Icon: CheckCircle2, // sobrescrito abaixo conforme ganho/perdido
    iconClass: 'text-emerald-600',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
}

/** Para 'fechado', escolhe variante ganho/perdido. */
function getConfigFechado(tipoFech: 'ganho' | 'perdido' | null | undefined): TipoConfig {
  if (tipoFech === 'perdido') {
    return {
      label: 'Fechado',
      Icon: XCircle,
      iconClass: 'text-red-500',
      dotClass: 'bg-red-500',
      badgeClass: 'bg-red-100 text-red-700',
    }
  }
  return {
    label: 'Fechado',
    Icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  }
}

// ─── Formatação de data ───────────────────────────────────────────────────────

/** YYYY-MM-DD → "dd/mm/aaaa" sem toISOString. */
function formatDataLocal(dateStr: string): string {
  // Detecta se é YYYY-MM-DD (apenas data) ou timestamptz (contém T)
  if (dateStr.includes('T')) {
    // É um timestamp; pode usar Date diretamente para exibição
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR')
  }
  // YYYY-MM-DD — parseie manualmente para evitar virada de UTC
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const year  = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1
  const day   = parseInt(dayStr, 10)
  return new Date(year, month, day).toLocaleDateString('pt-BR')
}

// ─── Componente interno: item da linha do tempo ───────────────────────────────

function EventoItem({
  evento,
  isLast,
}: {
  evento: EventoLinhaTempo
  isLast: boolean
}) {
  const baseConfig = TIPO_CONFIG[evento.tipo] ?? TIPO_CONFIG.nota
  const config =
    evento.tipo === 'fechado' ? getConfigFechado(evento.tipoFechamento) : baseConfig
  const { Icon } = config

  return (
    <li className="relative flex gap-3">
      {/* Linha vertical conectora */}
      {!isLast && (
        <span
          className="absolute left-[11px] top-7 bottom-0 w-px bg-border"
          aria-hidden="true"
        />
      )}

      {/* Dot + ícone */}
      <div className="relative mt-0.5 flex size-6 shrink-0 items-center justify-center">
        <span className={cn('size-2 rounded-full', config.dotClass)} />
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Icon className={cn('size-3.5 shrink-0', config.iconClass)} />
          <span
            className={cn(
              'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none',
              config.badgeClass
            )}
          >
            {config.label}
          </span>
          {evento.titulo && (
            <span className="text-xs font-medium text-foreground">{evento.titulo}</span>
          )}
          {/* Status do lembrete */}
          {evento.tipo === 'lembrete' && evento.status && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
              {evento.status}
            </span>
          )}
        </div>

        {evento.descricao && (
          <p className="mt-0.5 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {evento.descricao}
          </p>
        )}

        {evento.url && (
          <a
            href={evento.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600 underline hover:text-blue-800"
          >
            <ExternalLink className="size-3" />
            Ver no Google Calendar
          </a>
        )}

        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {formatDataLocal(evento.data)}
        </div>
      </div>
    </li>
  )
}

// ─── Conteúdo carregado do dialog ─────────────────────────────────────────────

function TimelineContent({ negocioId }: { negocioId: string }) {
  const [eventos, setEventos] = useState<EventoLinhaTempo[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Carrega ao montar (apenas uma vez)
  if (eventos === null && !isPending && erro === null) {
    startTransition(async () => {
      try {
        const data = await getLinhaTempoNegocio(negocioId)
        setEventos(data)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar linha do tempo.')
      }
    })
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (erro) {
    return (
      <p className="py-6 text-center text-sm text-destructive">{erro}</p>
    )
  }

  if (eventos !== null && eventos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <Clock className="size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum evento registrado neste negócio.</p>
      </div>
    )
  }

  if (eventos === null) return null

  return (
    <ul className="mt-2 flex flex-col">
      {eventos.map((ev, i) => (
        <EventoItem
          key={`${ev.tipo}-${ev.data}-${i}`}
          evento={ev}
          isLast={i === eventos.length - 1}
        />
      ))}
    </ul>
  )
}

// ─── Componente público ───────────────────────────────────────────────────────

interface BotaoTimelineProps {
  negocioId: string
  titulo: string
  /** Conteúdo clicável passado como children. Se omitido, renderiza o título como botão. */
  children?: React.ReactNode
}

/**
 * BotaoTimeline — qualquer element clicável que abre a linha do tempo de um negócio.
 * Passe `children` para customizar o trigger (ex.: o nome do negócio num card).
 */
export function BotaoTimeline({ negocioId, titulo, children }: BotaoTimelineProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Trigger clicável */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label={`Ver linha do tempo: ${titulo}`}
      >
        {children ?? titulo}
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85dvh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold leading-snug pr-6">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{titulo}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Linha do tempo — só carrega quando aberto */}
          {open && <TimelineContent negocioId={negocioId} />}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  )
}
