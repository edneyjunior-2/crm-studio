'use client'

import type { EstagioNegocio } from '@/types'

interface PipelineChartProps {
  contagens: Record<EstagioNegocio, number>
}

const ESTAGIOS: { key: EstagioNegocio; label: string; color: string; bg: string }[] = [
  { key: 'prospeccao', label: 'Prospecção', color: 'bg-slate-500', bg: 'bg-slate-100 dark:bg-slate-900' },
  { key: 'qualificacao', label: 'Qualificação', color: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-950' },
  { key: 'proposta', label: 'Proposta', color: 'bg-violet-500', bg: 'bg-violet-100 dark:bg-violet-950' },
  { key: 'negociacao', label: 'Negociação', color: 'bg-amber-500', bg: 'bg-amber-100 dark:bg-amber-950' },
  { key: 'fechado_ganho', label: 'Fechado Ganho', color: 'bg-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950' },
  { key: 'fechado_perdido', label: 'Fechado Perdido', color: 'bg-red-500', bg: 'bg-red-100 dark:bg-red-950' },
]

export function PipelineChart({ contagens }: PipelineChartProps) {
  const maxValor = Math.max(...ESTAGIOS.map((e) => contagens[e.key] ?? 0), 1)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-5 text-sm font-semibold text-foreground">Distribuição por Estágio</h3>
      <div className="flex items-end gap-3">
        {ESTAGIOS.map((estagio) => {
          const qtd = contagens[estagio.key] ?? 0
          const height = Math.max((qtd / maxValor) * 140, qtd > 0 ? 12 : 4)

          return (
            <div key={estagio.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-semibold text-foreground">{qtd > 0 ? qtd : ''}</span>
              <div className="flex w-full flex-col items-center">
                <div
                  className={`w-full rounded-t-md transition-all ${estagio.color} ${qtd === 0 ? 'opacity-20' : 'opacity-90'}`}
                  style={{ height: `${height}px` }}
                />
              </div>
              <span className="text-center text-[10px] leading-tight text-muted-foreground">
                {estagio.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
