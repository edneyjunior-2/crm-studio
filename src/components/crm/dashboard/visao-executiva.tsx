'use client'

import { DonutPipeline, type DonutFatia } from './donut-pipeline'
import { DonutProdutos, type ProdutoFatia } from './donut-produtos'
import { BarrasIndicadores, type IndicadorItem } from './barras-indicadores'

export type { DonutFatia, ProdutoFatia, IndicadorItem }

interface VisaoExecutivaProps {
  pipeline: {
    fatias: DonutFatia[]
    total: number
    totalNegocios: number
  }
  produtos: {
    fatias: ProdutoFatia[]
    total: number
  }
  indicadores: IndicadorItem[]
}

export function VisaoExecutiva({ pipeline, produtos, indicadores }: VisaoExecutivaProps) {
  return (
    <section className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Visão Executiva
        </h3>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* 3-column grid (stacks on mobile) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Donut Pipeline */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-foreground">
            Pipeline por Etapa
          </p>
          <DonutPipeline
            fatias={pipeline.fatias}
            total={pipeline.total}
            totalNegocios={pipeline.totalNegocios}
          />
        </div>

        {/* Card 2: Donut Produtos */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-foreground">
            Valor por Produto
          </p>
          <DonutProdutos
            fatias={produtos.fatias}
            total={produtos.total}
          />
        </div>

        {/* Card 3: Barras Indicadores */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-foreground">
            Top Indicadores por Valor
          </p>
          <BarrasIndicadores items={indicadores} />
        </div>
      </div>
    </section>
  )
}
