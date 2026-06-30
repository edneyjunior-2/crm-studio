'use client'

import { useReducedMotion, motion } from 'motion/react'

export interface IndicadorItem {
  id: string
  nome: string
  valor: number
  tipo: 'parceiro' | 'interno'
}

interface BarrasIndicadoresProps {
  items: IndicadorItem[]
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)

const BRLF = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function BarrasIndicadores({ items }: BarrasIndicadoresProps) {
  const prefersReduced = useReducedMotion()

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum negócio com indicador registrado.
      </p>
    )
  }

  const max = Math.max(...items.map((i) => i.valor), 1)

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const pct = (item.valor / max) * 100
        const isParceiro = item.tipo === 'parceiro'

        return (
          <div key={item.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isParceiro
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-emerald-500/10 text-emerald-600'
                  }`}
                >
                  {isParceiro ? 'Parceiro' : 'Time'}
                </span>
                <span className="truncate text-xs font-medium text-foreground">
                  {item.nome}
                </span>
              </div>
              <span className="shrink-0 tabular-nums text-xs font-semibold text-foreground">
                {BRL(item.valor)}
              </span>
            </div>

            {/* Bar track */}
            <div className="h-5 w-full overflow-hidden rounded-full bg-muted/40">
              <motion.div
                className={`h-full rounded-full ${isParceiro ? 'bg-blue-500' : 'bg-emerald-500'}`}
                initial={prefersReduced ? { width: `${pct}%` } : { width: '0%' }}
                animate={{ width: `${pct}%` }}
                transition={
                  prefersReduced
                    ? undefined
                    : {
                        duration: 0.7,
                        delay: 0.1 + index * 0.06,
                        ease: [0.16, 1, 0.3, 1],
                      }
                }
                title={BRLF(item.valor)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
