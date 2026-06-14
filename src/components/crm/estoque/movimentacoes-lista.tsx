'use client'

import { TrendingUp, TrendingDown, SlidersHorizontal, ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MovimentacaoEstoque } from '@/types/estoque'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatarData(dataStr: string): string {
  // Usar getFullYear/getMonth/getDate para evitar problema de timezone com toISOString
  const [y, m, d] = dataStr.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('pt-BR')
}

const TIPO_CONFIG = {
  entrada: {
    label: 'Entrada',
    icon: TrendingUp,
    badgeClass: 'text-emerald-600 border-emerald-200 bg-emerald-50',
    valorClass: 'text-emerald-600',
    sinal: '+',
  },
  saida: {
    label: 'Saída',
    icon: TrendingDown,
    badgeClass: 'text-red-600 border-red-200 bg-red-50',
    valorClass: 'text-red-600',
    sinal: '-',
  },
  ajuste: {
    label: 'Ajuste',
    icon: SlidersHorizontal,
    badgeClass: 'text-amber-600 border-amber-200 bg-amber-50',
    valorClass: 'text-amber-600',
    sinal: '±',
  },
} as const

interface MovimentacoesListaProps {
  movimentacoes: MovimentacaoEstoque[]
}

export function MovimentacoesLista({ movimentacoes }: MovimentacoesListaProps) {
  if (movimentacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <ClipboardList className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhuma movimentação registrada ainda.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
      {movimentacoes.map((mov) => {
        const config = TIPO_CONFIG[mov.tipo]
        const Icon = config.icon
        const nomeProduto = mov.produtos?.nome ?? 'Produto removido'
        const unidade = mov.produtos?.unidade ?? 'un'
        const valorTotal =
          mov.custo_unitario != null ? mov.quantidade * mov.custo_unitario : null

        return (
          <div
            key={mov.id}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className={`size-4 ${config.valorClass}`} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="truncate text-sm font-medium text-foreground">
                  {nomeProduto}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatarData(mov.data)}
                  </span>
                  {mov.motivo && (
                    <span className="truncate text-xs text-muted-foreground">
                      · {mov.motivo}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className={`font-mono text-sm font-semibold ${config.valorClass}`}>
                {config.sinal}{Math.abs(mov.quantidade)} {unidade}
              </span>
              {valorTotal != null && (
                <span className="font-mono text-xs text-muted-foreground">
                  {BRL(valorTotal)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
