'use client'

import { corPorTipo, type EstagioPipeline } from '@/lib/estagios-ui'

interface PipelineChartProps {
  estagios: EstagioPipeline[]
  contagens: Record<string, number>
}

export function PipelineChart({ estagios, contagens }: PipelineChartProps) {
  const maxValor = Math.max(...estagios.map((e) => contagens[e.slug] ?? 0), 1)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-5 text-sm font-semibold text-foreground">Distribuição por Estágio</h3>
      <div className="flex items-end gap-3">
        {estagios.map((estagio) => {
          const qtd = contagens[estagio.slug] ?? 0
          const height = Math.max((qtd / maxValor) * 140, qtd > 0 ? 12 : 4)
          const { dot } = corPorTipo(estagio.tipo)

          return (
            <div key={estagio.slug} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-semibold text-foreground">{qtd > 0 ? qtd : ''}</span>
              <div className="flex w-full flex-col items-center">
                <div
                  className={`w-full rounded-t-md transition-all ${dot} ${qtd === 0 ? 'opacity-20' : 'opacity-90'}`}
                  style={{ height: `${height}px` }}
                />
              </div>
              <span className="text-center text-[10px] leading-tight text-muted-foreground">
                {estagio.nome}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
