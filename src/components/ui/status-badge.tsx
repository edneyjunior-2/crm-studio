import type React from 'react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  // financeiro
  pendente:    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  pago:        'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  recebido:    'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  atrasado:    'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  cancelado:   'bg-muted text-muted-foreground',
  // pipeline
  prospeccao:  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  qualificacao: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  proposta:    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  negociacao:  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  fechado_ganho: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  fechado_perdido: 'bg-muted text-muted-foreground',
  // processos
  ativo:       'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  encerrado:   'bg-muted text-muted-foreground',
  arquivado:   'bg-muted text-muted-foreground',
  aguardando:  'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  // atendimento
  bot:         'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  humano:      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  resolvido:   'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  adiado:      'bg-muted text-muted-foreground',
  // genéricos
  ativo_generico: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  inativo:     'bg-muted text-muted-foreground',
  // parceiros
  contrato_assinado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  sem_contrato: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  comissao:    'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  // clientes
  privada:     'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  publica:     'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  // importação
  ok:          'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  invalido:    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
} as const

/** Estilo neutro (slate) usado como fallback para variantes desconhecidas. */
const VARIANT_FALLBACK = 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'

export type StatusBadgeVariant = keyof typeof VARIANTS

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: StatusBadgeVariant | string
  children: React.ReactNode
}

export function StatusBadge({ variant, children, className, ...props }: StatusBadgeProps) {
  const variantClass = (VARIANTS as Record<string, string>)[variant] ?? VARIANT_FALLBACK
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', variantClass, className)} {...props}>
      {children}
    </span>
  )
}
