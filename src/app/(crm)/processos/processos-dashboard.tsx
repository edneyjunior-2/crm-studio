'use client'

import { Scale, Bell, RefreshCw, FolderOpen } from 'lucide-react'
import type { QuickFilter } from './processos-filter'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface ProcessoStats {
  total:        number
  porStatus:    { status: string; count: number }[]
  porArea:      { area: string;   count: number }[]
  totalNaoLidos: number
  semDataJud:   number
}

// ---------------------------------------------------------------------------
// Configuração visual por área
// ---------------------------------------------------------------------------
const AREA_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  tributario:      { label: 'Tributário',        color: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/30' },
  civel:           { label: 'Cível',              color: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
  previdenciario:  { label: 'Previdenciário',     color: 'bg-green-500',   bg: 'bg-green-50 dark:bg-green-950/30' },
  precatorio:      { label: 'Precatório',         color: 'bg-purple-500',  bg: 'bg-purple-50 dark:bg-purple-950/30' },
  fazenda_publica: { label: 'Fazenda Pública',    color: 'bg-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  trabalhista:     { label: 'Trabalhista',        color: 'bg-orange-500',  bg: 'bg-orange-50 dark:bg-orange-950/30' },
  criminal:        { label: 'Criminal',           color: 'bg-red-500',     bg: 'bg-red-50 dark:bg-red-950/30' },
  familia:         { label: 'Família',            color: 'bg-pink-500',    bg: 'bg-pink-50 dark:bg-pink-950/30' },
  administrativo:  { label: 'Administrativo',     color: 'bg-slate-500',   bg: 'bg-slate-50 dark:bg-slate-950/30' },
  outro:           { label: 'Outro',              color: 'bg-zinc-400',    bg: 'bg-zinc-50 dark:bg-zinc-950/30' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; text: string }> = {
  ativo:      { label: 'Ativo',      color: 'bg-green-500',  text: 'text-green-700 dark:text-green-400' },
  encerrado:  { label: 'Encerrado',  color: 'bg-slate-400',  text: 'text-slate-600 dark:text-slate-400' },
  suspenso:   { label: 'Suspenso',   color: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400' },
  arquivado:  { label: 'Arquivado',  color: 'bg-zinc-400',   text: 'text-zinc-600 dark:text-zinc-400' },
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
interface DashboardProps {
  stats:        ProcessoStats
  quickFilter:  QuickFilter
  onFilter:     (f: QuickFilter) => void
}

export function ProcessosDashboard({ stats, quickFilter, onFilter }: DashboardProps) {
  const maxArea   = Math.max(...stats.porArea.map((a) => a.count), 1)
  const maxStatus = Math.max(...stats.porStatus.map((s) => s.count), 1)

  function toggle(f: NonNullable<QuickFilter>) {
    onFilter(quickFilter === f ? null : f)
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Cards de resumo (clicáveis) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

        <StatCard
          icon={<Scale className="size-5 text-[#14233A] dark:text-foreground" />}
          label="Total de processos"
          value={stats.total}
          bg="bg-[#14233A]/5 dark:bg-[#14233A]/20"
          active={quickFilter === null}
          onClick={() => onFilter(null)}
        />
        <StatCard
          icon={<Bell className="size-5 text-amber-500" />}
          label="Movimentações novas"
          value={stats.totalNaoLidos}
          bg="bg-amber-50 dark:bg-amber-950/30"
          highlight={stats.totalNaoLidos > 0}
          highlightColor="text-amber-600 dark:text-amber-400"
          active={quickFilter === 'novas_movimentacoes'}
          onClick={() => toggle('novas_movimentacoes')}
        />
        <StatCard
          icon={<RefreshCw className="size-5 text-blue-500" />}
          label="Ativos no DataJud"
          value={stats.porStatus.find((s) => s.status === 'ativo')?.count ?? 0}
          bg="bg-blue-50 dark:bg-blue-950/30"
          active={quickFilter === 'ativos'}
          onClick={() => toggle('ativos')}
        />
        <StatCard
          icon={<FolderOpen className="size-5 text-slate-400" />}
          label="Sem dados DataJud"
          value={stats.semDataJud}
          bg="bg-secondary"
          highlight={stats.semDataJud > 0}
          highlightColor="text-muted-foreground"
          active={quickFilter === 'sem_datajud'}
          onClick={() => toggle('sem_datajud')}
        />
      </div>

      {/* ── Gráficos ── */}
      {(stats.porArea.length > 0 || stats.porStatus.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Por área */}
          {stats.porArea.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-4 text-sm font-semibold text-foreground">Processos por área</p>
              <div className="flex flex-col gap-2.5">
                {stats.porArea
                  .sort((a, b) => b.count - a.count)
                  .map(({ area, count }) => {
                    const cfg = AREA_CONFIG[area] ?? { label: area, color: 'bg-secondary', bg: 'bg-secondary' }
                    const pct = Math.round((count / maxArea) * 100)
                    return (
                      <div key={area} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{cfg.label}</span>
                        <div className="relative flex-1 overflow-hidden rounded-full bg-secondary h-2">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full ${cfg.color} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-semibold text-foreground">{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Por status */}
          {stats.porStatus.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-4 text-sm font-semibold text-foreground">Processos por status</p>
              <div className="flex flex-col gap-2.5">
                {stats.porStatus
                  .sort((a, b) => b.count - a.count)
                  .map(({ status, count }) => {
                    const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-secondary', text: 'text-muted-foreground' }
                    const pct = Math.round((count / maxStatus) * 100)
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className={`w-24 shrink-0 text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                        <div className="relative flex-1 overflow-hidden rounded-full bg-secondary h-2">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full ${cfg.color} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-semibold text-foreground">{count}</span>
                      </div>
                    )
                  })}
              </div>

              {/* Mini legenda de status em pill */}
              <div className="mt-4 flex flex-wrap gap-2">
                {stats.porStatus.map(({ status, count }) => {
                  const cfg = STATUS_CONFIG[status]
                  if (!cfg) return null
                  return (
                    <span key={status} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cfg.text} bg-secondary`}>
                      <span className={`size-1.5 rounded-full ${cfg.color}`} />
                      {cfg.label}: {count}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
function StatCard({
  icon, label, value, bg, highlight, highlightColor, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bg: string
  highlight?: boolean
  highlightColor?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col gap-3 rounded-xl border p-4 text-left transition-all',
        active
          ? 'border-foreground/40 ring-2 ring-foreground/20 shadow-sm'
          : 'border-border hover:border-foreground/20 hover:shadow-sm',
        bg,
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        {icon}
        {highlight && value > 0 && (
          <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
        )}
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none ${highlight && value > 0 ? highlightColor : 'text-foreground'}`}>
          {value.toLocaleString('pt-BR')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  )
}
