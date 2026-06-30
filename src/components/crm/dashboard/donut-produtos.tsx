'use client'

import { useReducedMotion, motion } from 'motion/react'
import { useEffect, useState } from 'react'

export interface ProdutoFatia {
  solucao_id: string | null
  nome: string
  valor: number
  corHex: string
}

interface DonutProdutosProps {
  fatias: ProdutoFatia[]
  total: number
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const BRLC = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)

const SIZE = 180
const STROKE = 28
const R = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R
const CX = SIZE / 2
const CY = SIZE / 2

export function DonutProdutos({ fatias, total }: DonutProdutosProps) {
  const prefersReduced = useReducedMotion()
  const [progress, setProgress] = useState(prefersReduced ? 1 : 0)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    if (prefersReduced) { setProgress(1); return }
    const t = setTimeout(() => setProgress(1), 200)
    return () => clearTimeout(t)
  }, [prefersReduced])

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem produtos vinculados a negócios.
      </p>
    )
  }

  const GAP_CIRC = fatias.length > 1 ? (2 / 360) * CIRC : 0
  let cumPct = 0
  type Arc = { key: string; nome: string; valor: number; corHex: string; dash: number; offset: number; pct: number }
  const arcs: Arc[] = []

  for (const f of fatias) {
    const pct = f.valor / total
    const rawDash = pct * CIRC * progress
    const dash = Math.max(rawDash - GAP_CIRC, 0)
    const offset = -(cumPct * CIRC * progress) + CIRC / 4
    arcs.push({ key: f.solucao_id ?? f.nome, nome: f.nome, valor: f.valor, corHex: f.corHex, dash, offset, pct })
    cumPct += pct
  }

  const hoveredKey = hovered
  const hoveredF = fatias.find((f) => (f.solucao_id ?? f.nome) === hoveredKey)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="block">
          <circle
            cx={CX} cy={CY} r={R}
            fill="none" stroke="currentColor" strokeWidth={STROKE}
            className="text-muted/30"
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={arc.corHex}
              strokeWidth={hovered === arc.key ? STROKE + 4 : STROKE}
              strokeDasharray={`${arc.dash} ${CIRC}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              style={{
                transition: prefersReduced
                  ? 'none'
                  : 'stroke-dasharray 0.75s cubic-bezier(0.16,1,0.3,1), stroke-width 0.15s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHovered(arc.key)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hoveredF ? (
            <>
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none text-center">
                {hoveredF.nome}
              </span>
              <span className="mt-1 text-lg font-bold tabular-nums text-foreground leading-none">
                {BRLC(hoveredF.valor)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {Math.round((hoveredF.valor / total) * 100)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Produtos
              </span>
              <span className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                {BRLC(total)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex w-full flex-col gap-1.5">
        {fatias.map((f, i) => {
          const key = f.solucao_id ?? f.nome
          return (
            <motion.div
              key={key}
              initial={prefersReduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={prefersReduced ? undefined : { duration: 0.35, delay: 0.55 + i * 0.06 }}
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors"
              style={{
                backgroundColor: hovered === key ? `${f.corHex}18` : 'transparent',
                cursor: 'default',
              }}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.corHex }} />
              <span className="flex-1 min-w-0 truncate text-xs text-foreground/80">{f.nome}</span>
              <div className="shrink-0 flex flex-col items-end">
                <span className="tabular-nums text-xs font-semibold text-foreground">{BRL(f.valor)}</span>
                <span className="text-[10px] text-muted-foreground">{Math.round((f.valor / total) * 100)}%</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
