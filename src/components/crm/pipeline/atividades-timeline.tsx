import { Phone, Mail, Users, FileText, StickyNote, CalendarX } from 'lucide-react'
import type { AtividadeItem } from '@/app/(crm)/pipeline/atividade-actions'

interface AtividadesTimelineProps {
  atividades: AtividadeItem[]
}

const TIPO_CONFIG = {
  ligacao: {
    label: 'Ligação',
    Icon: Phone,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  email: {
    label: 'E-mail',
    Icon: Mail,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
  },
  reuniao: {
    label: 'Reunião',
    Icon: Users,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
  },
  proposta: {
    label: 'Proposta',
    Icon: FileText,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
  },
  nota: {
    label: 'Nota',
    Icon: StickyNote,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    badge: 'bg-slate-100 text-slate-700',
  },
} as const

function formatarData(dataStr: string): string {
  const [yearStr, monthStr, dayStr] = dataStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1
  const day = parseInt(dayStr, 10)
  const date = new Date(year, month, day)
  return date.toLocaleDateString('pt-BR')
}

export function AtividadesTimeline({ atividades }: AtividadesTimelineProps) {
  if (atividades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-400">
        <CalendarX className="size-8" />
        <p className="text-sm">Nenhuma atividade registrada.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-100">
      {atividades.map((atividade) => {
        const config = TIPO_CONFIG[atividade.tipo] ?? TIPO_CONFIG.nota
        const { Icon } = config

        return (
          <li key={atividade.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
            {/* Ícone */}
            <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
              <Icon className={`size-4 ${config.color}`} />
            </div>

            {/* Conteúdo */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {/* Cabeçalho: badge de tipo */}
              <span
                className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium ${config.badge}`}
              >
                {config.label}
              </span>

              {/* Descrição — nunca truncada */}
              {atividade.descricao && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{atividade.descricao}</p>
              )}

              {/* Link Google Calendar */}
              {atividade.google_event_url && (
                <a
                  href={atividade.google_event_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  Ver no Google Calendar
                </a>
              )}

              {/* Rodapé: responsável + data */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                {atividade.responsavel_nome && (
                  <span>{atividade.responsavel_nome}</span>
                )}
                {atividade.responsavel_nome && (
                  <span aria-hidden="true">·</span>
                )}
                <span>{formatarData(atividade.data_atividade)}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
