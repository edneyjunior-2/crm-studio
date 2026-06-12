'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Users, TrendingUp, DollarSign, BarChart3, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mapa nome->componente. O Server Component passa o NOME (string) do ícone,
// não o componente em si — funções não podem cruzar a fronteira RSC server->client.
const ICON_MAP: Record<string, LucideIcon> = {
  Users,
  TrendingUp,
  DollarSign,
  BarChart3,
}

export interface MetricaCard {
  label: string
  value: string
  description: string
  icon: string
  iconBg: string
  iconColor: string
}

interface MetricasAnimadasProps {
  cards: MetricaCard[]
  isFinanceiro: boolean
}

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1]

export function MetricasAnimadas({ cards, isFinanceiro }: MetricasAnimadasProps) {
  const prefersReduced = useReducedMotion()

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2',
        isFinanceiro ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
      )}
    >
      {cards.map((card, index) => {
        const Icon = ICON_MAP[card.icon] ?? Users
        const isAnchor = index === 0

        return (
          <motion.div
            key={card.label}
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            animate={prefersReduced ? false : { opacity: 1, y: 0 }}
            transition={
              prefersReduced
                ? undefined
                : {
                    duration: 0.5,
                    delay: index * 0.08,
                    ease: EASING,
                  }
            }
            whileHover={prefersReduced ? undefined : { scale: 1.015 }}
            whileTap={prefersReduced ? undefined : isAnchor ? { scale: 0.98 } : undefined}
            // whileHover usa spring — transition separada via style
            className={cn(
              'flex flex-col justify-between gap-6 rounded-xl p-5',
              isAnchor
                ? 'bg-primary shadow-md'
                : 'border border-border bg-card shadow-sm hover:shadow-md'
            )}
            style={{ cursor: 'default' }}
          >
            {/* Icone + label */}
            <motion.div
              className="flex items-start justify-between gap-2"
              whileHover={prefersReduced ? undefined : { scale: 1.015 }}
              transition={
                prefersReduced
                  ? undefined
                  : { type: 'spring', stiffness: 400, damping: 30 }
              }
            >
              <span
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider leading-tight',
                  isAnchor ? 'text-primary-foreground/60' : 'text-muted-foreground'
                )}
              >
                {card.label}
              </span>
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg',
                  isAnchor ? 'bg-white/10' : card.iconBg
                )}
              >
                <Icon
                  className={cn(
                    'size-4',
                    isAnchor ? 'text-white/70' : card.iconColor
                  )}
                />
              </div>
            </motion.div>

            {/* Valor + descricao */}
            <div>
              <p
                className={cn(
                  'truncate tabular-nums text-3xl font-bold leading-none',
                  isAnchor ? 'text-primary-foreground' : 'text-foreground'
                )}
              >
                {card.value}
              </p>
              <p
                className={cn(
                  'mt-1.5 text-xs',
                  isAnchor ? 'text-primary-foreground/50' : 'text-muted-foreground'
                )}
              >
                {card.description}
              </p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
