'use client'

/**
 * Banner de aviso de assinatura — exibido no topo do shell do CRM.
 * Visível somente quando status ∈ {trial, pendente, atrasado}.
 * Para status 'ativo' → null (não renderiza nada).
 */

import { AlertTriangle, Clock, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { StatusEmpresa } from '@/lib/auth'

interface BannerAssinaturaProps {
  status: StatusEmpresa
  diasRestantes?: number | null
}

const bannerConfig: Record<
  'trial' | 'pendente' | 'atrasado',
  {
    icon: React.ElementType
    texto: (dias?: number | null) => string
    className: string
  }
> = {
  trial: {
    icon: Clock,
    texto: (dias) =>
      dias != null && dias > 0
        ? `Período de teste — ${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}.`
        : 'Período de teste ativo.',
    className:
      'bg-sidebar-primary/10 border-sidebar-primary/30 text-sidebar-primary',
  },
  pendente: {
    icon: CreditCard,
    texto: () => 'Pagamento em processamento. Sua conta permanece ativa.',
    className:
      'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  },
  atrasado: {
    icon: AlertTriangle,
    texto: () =>
      'Pagamento em atraso. Regularize para evitar a suspensão da conta.',
    className:
      'bg-destructive/10 border-destructive/30 text-destructive',
  },
}

export function BannerAssinatura({ status, diasRestantes }: BannerAssinaturaProps) {
  if (status === 'ativo' || status === 'suspenso' || status === 'cancelado') {
    return null
  }

  const config = bannerConfig[status]
  if (!config) return null

  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b px-4 py-2 text-xs font-medium',
        config.className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>{config.texto(diasRestantes)}</span>
      <Link
        href="/assinatura"
        className="ml-auto shrink-0 underline underline-offset-2 hover:no-underline"
      >
        Ver planos
      </Link>
    </div>
  )
}
