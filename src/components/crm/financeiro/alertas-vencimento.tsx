'use client'

import { AlertTriangle } from 'lucide-react'
import { MarcarPagoDialog, type BancoComSaldo } from './marcar-pago-dialog'
import { formatMoeda } from '@/lib/moedas'
import type { ContaPagar } from '@/types'

interface AlertasVencimentoProps {
  contas: ContaPagar[]
  bancos: BancoComSaldo[]
}

export function AlertasVencimento({ contas, bancos }: AlertasVencimentoProps) {
  const hoje = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const venceHoje = contas.filter(
    (c) => c.data_vencimento === hoje && c.status === 'pendente'
  )
  const atrasadas = contas.filter(
    (c) => c.data_vencimento < hoje && (c.status === 'pendente' || c.status === 'atrasado')
  )

  if (venceHoje.length === 0 && atrasadas.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {atrasadas.map((conta) => (
        <div
          key={conta.id}
          className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900/50 dark:bg-orange-950/20"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
              Atrasada
            </p>
            <p className="truncate text-sm font-medium text-orange-900 dark:text-orange-200">
              {conta.descricao}
              {conta.fornecedor && (
                <span className="font-normal text-orange-700 dark:text-orange-400"> · {conta.fornecedor}</span>
              )}
            </p>
          </div>

          <span className="shrink-0 font-mono text-sm font-semibold text-orange-800 dark:text-orange-300">
            {formatMoeda(conta.valor, conta.moeda)}
          </span>

          <MarcarPagoDialog conta={conta} bancos={bancos} />
        </div>
      ))}

      {venceHoje.map((conta) => (
        <div
          key={conta.id}
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
              Vence hoje
            </p>
            <p className="truncate text-sm font-medium text-red-900 dark:text-red-200">
              {conta.descricao}
              {conta.fornecedor && (
                <span className="font-normal text-red-700 dark:text-red-400"> · {conta.fornecedor}</span>
              )}
            </p>
          </div>

          <span className="shrink-0 font-mono text-sm font-semibold text-red-800 dark:text-red-300">
            {formatMoeda(conta.valor, conta.moeda)}
          </span>

          <MarcarPagoDialog conta={conta} bancos={bancos} />
        </div>
      ))}
    </div>
  )
}
