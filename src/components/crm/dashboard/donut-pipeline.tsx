'use client'

import { useReducedMotion, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { EstagioPipeline } from '@/lib/estagios-ui'

export interface DonutFatia {
  slug: string
  nome: string
  valor: number
  cor: string // hex ou tailwind-safe class — aqui usamos hex gerado no server
  corHex: string
}

interface DonutPipelineProps {
  fatias: DonutFatia[]
  total: number
  totalNegocios: number
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v)

const BRLF = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const SIZE = 200
const STROKE = 32
const R = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R
const CX = SIZE / 2
const CY = SIZE / 2

export function DonutPipeline({ fatias, total, totalNegocios }: DonutPipelineProps) {
  const prefersReduced = useReducedMotion()
  const [progress, setProgress] = useState(prefersReduced ? 1 : 0)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    if (prefersReduced) { setProgress(1); return }
    const t = setTimeout(() => {
      setProgress(1)
    }, 120)
    return () => clearTimeout(t)
  }, [prefersReduced])

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum negócio com valor no pipeline.
      </p>
    )
  }

  // Build arcs
  type Arc = { slug: string; nome: string; valor: number; corHex: string; dash: number; offset: number; pct: number }
  const arcs: Arc[] = []
  let cumPct = 0
  // Gap between arcs (degrees)
  const GAP_DEG = fatias.length > 1 ? 2 : 0
  const GAP_CIRC = (GAP_DEG / 360) * CIRC

  for (const f of fatias) {
    const pct = f.valor / total
    const rawDash = pct * CIRC * progress
    const dash = Math.max(rawDash - GAP_CIRC, 0)
    // offset starts at top (-CIRC/4), then advances
    const offset = -(cumPct * CIRC * progress) + CIRC / 4
    arcs.push({ slug: f.slug, nome: f.nome, valor: f.valor, corHex: f.corHex, dash, offset, pct })
    cumPct += pct
  }

  const hoveredFatia = fatias.find((f) => f.slug === hovered)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="block">
          {/* Track */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-muted/30"
          />
          {arcs.map((arc) => (
            <circle
              key={arc.slug}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={arc.corHex}
              strokeWidth={hovered === arc.slug ? STROKE + 4 : STROKE}
              strokeDasharray={`${arc.dash} ${CIRC}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              style={{
                transition: prefersReduced
                  ? 'none'
                  : 'stroke-dasharray 0.7s cubic-bezier(0.16,1,0.3,1), stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1), stroke-width 0.15s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHovered(arc.slug)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {/* Centre */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {hoveredFatia ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                {hoveredFatia.nome}
              </span>
              <span className="mt-1 text-xl font-bold tabular-nums text-foreground leading-none">
                {BRL(hoveredFatia.valor)}
              </span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">
                {Math.round((hoveredFatia.valor / total) * 100)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                Pipeline
              </span>
              <span className="mt-0.5 text-xl font-bold tabular-nums text-foreground leading-tight">
                {BRL(total)}
              </span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">
                {totalNegocios} negócio{totalNegocios !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex w-full flex-col gap-1.5">
        {fatias.map((f, i) => (
          <motion.div
            key={f.slug}
            initial={prefersReduced ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={prefersReduced ? undefined : { duration: 0.35, delay: 0.5 + i * 0.05 }}
            className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors"
            style={{
              backgroundColor: hovered === f.slug ? `${f.corHex}18` : 'transparent',
              cursor: 'default',
            }}
            onMouseEnter={() => setHovered(f.slug)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: f.corHex }}
            />
            <span className="flex-1 truncate text-xs text-foreground/80">{f.nome}</span>
            <span className="shrink-0 tabular-nums text-xs font-semibold text-foreground">
              {BRLF(f.valor)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
