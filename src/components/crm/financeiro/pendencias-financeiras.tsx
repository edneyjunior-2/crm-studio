'use client'

import { useState } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MarcarPagoDialog, type BancoComSaldo } from './marcar-pago-dialog'
import { ContaPagarForm } from './conta-pagar-form'
import { formatMoeda } from '@/lib/moedas'
import { cn } from '@/lib/utils'
import type { ContaPagar, Fornecedor } from '@/types'

type FornecedorLite = Pick<Fornecedor, 'id' | 'nome' | 'pix_tipo' | 'pix_chave' | 'telefone'>

interface PendenciasFinanceirasProps {
  contas: ContaPagar[]
  bancos: BancoComSaldo[]
  fornecedores?: FornecedorLite[]
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return new Date(+year, +month - 1, +day).toLocaleDateString('pt-BR')
}

function calcDiasAtraso(dataVencimento: string): number {
  const [y, m, d] = dataVencimento.split('-').map(Number)
  const venc = new Date(y, m - 1, d)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  venc.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)))
}

function StatusBadge({ status, diasAtraso }: { status: ContaPagar['status']; diasAtraso: number }) {
  if (status === 'atrasado' || diasAtraso > 0) {
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400 shrink-0 whitespace-nowrap">
        {diasAtraso > 0 ? `${diasAtraso}d em atraso` : 'Atrasado'}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 shrink-0">
      Pendente
    </Badge>
  )
}

export function PendenciasFinanceiras({ contas, bancos, fornecedores = [] }: PendenciasFinanceirasProps) {
  const [aberto, setAberto] = useState(false)

  if (contas.length === 0) return null

  const atrasadas = contas.filter((c) => c.status === 'atrasado' || calcDiasAtraso(c.data_vencimento) > 0)
  const pendentes = contas.filter((c) => c.status === 'pendente' && calcDiasAtraso(c.data_vencimento) === 0)

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
      {/* Cabeçalho clicável */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Pendências Financeiras
          </span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {contas.length}
          </span>
          {atrasadas.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-[11px] font-semibold text-red-700 dark:text-red-300">
              {atrasadas.length} atrasada{atrasadas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'size-4 text-amber-600 transition-transform duration-200 dark:text-amber-400',
            aberto && 'rotate-180'
          )}
        />
      </button>

      {/* Lista — só aparece quando aberto */}
      {aberto && (
        <div className="flex flex-col divide-y divide-amber-200/60 dark:divide-amber-900/30 border-t border-amber-200 dark:border-amber-900/40">
          {atrasadas.map((conta) => {
            const dias = calcDiasAtraso(conta.data_vencimento)
            return (
              <div key={conta.id} className="flex items-center gap-3 bg-red-50/40 px-4 py-2.5 dark:bg-red-950/10">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {conta.descricao}
                    {(conta.fornecedor) && (
                      <span className="ml-1.5 font-normal text-muted-foreground">· {conta.fornecedor}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Venceu em {formatDate(conta.data_vencimento)}
                    {conta.categoria ? ` · ${conta.categoria}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {formatMoeda(conta.valor, conta.moeda)}
                  </span>
                  <StatusBadge status={conta.status} diasAtraso={dias} />
                  <div className="flex items-center gap-1">
                    <MarcarPagoDialog conta={conta} bancos={bancos} />
                    <ContaPagarForm
                      conta={conta}
                      trigger={
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-amber-200/60 hover:text-foreground dark:hover:bg-amber-900/30" aria-label="Editar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      }
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {pendentes.map((conta) => (
            <div key={conta.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {conta.descricao}
                  {(conta.fornecedor) && (
                    <span className="ml-1.5 font-normal text-muted-foreground">· {conta.fornecedor}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vence em {formatDate(conta.data_vencimento)}
                  {conta.categoria ? ` · ${conta.categoria}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {formatMoeda(conta.valor, conta.moeda)}
                </span>
                <StatusBadge status={conta.status} diasAtraso={0} />
                <div className="flex items-center gap-1">
                  <MarcarPagoDialog conta={conta} bancos={bancos} />
                  <ContaPagarForm
                    conta={conta}
                    fornecedores={fornecedores}
                    trigger={
                      <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-amber-200/60 hover:text-foreground dark:hover:bg-amber-900/30" aria-label="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
