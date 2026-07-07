'use client'

import { useReducedMotion } from 'motion/react'

const ITEMS = [
  'Saia das planilhas de vez',
  'Tudo num só lugar, sem duplicar dado',
  'CRM para qualquer tipo de empresa',
  'Ative só o que a sua operação precisa',
  'Comercial · Financeiro · Contratos · RH',
  'Preço fixo por empresa — não por usuário',
  'Versões prontas: advocacia e engenharia',
  '14 dias grátis · Setup em 30 min',
]

export function InfiniteSlider({ className }: { className?: string }) {
  const reduce = useReducedMotion()

  const items = [...ITEMS, ...ITEMS]

  if (reduce) {
    return (
      <div className={`overflow-hidden border-y border-border py-4 ${className ?? ''}`}>
        <div className="flex flex-wrap justify-center gap-3 px-6">
          {ITEMS.map((item) => (
            <Pill key={item} text={item} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`overflow-hidden border-y border-border py-4 ${className ?? ''}`}
      style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)' }}
    >
      <div
        className="flex w-max gap-3"
        style={{ animation: 'infinite-slide 28s linear infinite' }}
      >
        {items.map((item, i) => (
          <Pill key={`${item}-${i}`} text={item} />
        ))}
      </div>

      <style>{`
        @keyframes infinite-slide {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="infinite-slide"] { animation: none; }
        }
      `}</style>
    </div>
  )
}

function Pill({ text }: { text: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap">
      {text}
    </span>
  )
}
