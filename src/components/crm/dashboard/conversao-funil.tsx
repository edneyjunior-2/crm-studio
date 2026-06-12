'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import type { EstagioNegocio } from '@/types'

interface ConversaoFunilProps {
  contagens: Record<string, number>
}

// Etapas do funil em ordem (excluindo fechado_perdido)
const ETAPAS: {
  key: EstagioNegocio
  label: string
  barColor: string
  textColor: string
  bgColor: string
}[] = [
  {
    key: 'prospeccao',
    label: 'Prospecção',
    barColor: 'bg-slate-500',
    textColor: 'text-slate-700',
    bgColor: 'bg-slate-100',
  },
  {
    key: 'qualificacao',
    label: 'Qualificação',
    barColor: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  {
    key: 'proposta',
    label: 'Proposta',
    barColor: 'bg-violet-500',
    textColor: 'text-violet-700',
    bgColor: 'bg-violet-100',
  },
  {
    key: 'negociacao',
    label: 'Negociação',
    barColor: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-100',
  },
  {
    key: 'fechado_ganho',
    label: 'Fechado Ganho',
    barColor: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
  },
]

export function ConversaoFunil({ contagens }: ConversaoFunilProps) {
  const [aberto, setAberto] = useState(false)

  const valores = ETAPAS.map((e) => contagens[e.key] ?? 0)
  const maxValor = Math.max(...valores, 1)

  // Só exibe se houver pelo menos 1 negócio
  const totalNegocios = valores.reduce((s, v) => s + v, 0)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <TrendingDown className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Taxa de Conversão por Etapa</span>
        </div>
        {aberto
          ? <ChevronUp className="size-4 text-muted-foreground" />
          : <ChevronDown className="size-4 text-muted-foreground" />
        }
      </button>

      {aberto && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          {totalNegocios === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum negócio registrado ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {ETAPAS.map((etapa, index) => {
                const qtd = valores[index]
                const qtdAnterior = index === 0 ? null : valores[index - 1]

                // Taxa de conversão em relação à etapa anterior
                const taxa =
                  qtdAnterior !== null && qtdAnterior > 0
                    ? Math.round((qtd / qtdAnterior) * 100)
                    : null

                // Largura proporcional ao maior valor
                const larguraPercent = maxValor > 0 ? Math.max((qtd / maxValor) * 100, qtd > 0 ? 8 : 3) : 3

                return (
                  <div key={etapa.key} className="flex flex-col gap-1">
                    {/* Linha da etapa */}
                    <div className="flex items-center gap-3">
                      {/* Barra proporcional */}
                      <div className="flex-1 h-7 bg-muted/40 rounded-md overflow-hidden">
                        <div
                          className={`h-full rounded-md transition-all duration-500 ${etapa.barColor} ${qtd === 0 ? 'opacity-20' : 'opacity-85'}`}
                          style={{ width: `${larguraPercent}%` }}
                        />
                      </div>

                      {/* Nome da etapa */}
                      <span
                        className={`w-28 shrink-0 text-xs font-medium ${etapa.textColor}`}
                      >
                        {etapa.label}
                      </span>

                      {/* Contagem */}
                      <span className="w-8 shrink-0 text-right text-sm font-bold text-foreground">
                        {qtd}
                      </span>

                      {/* Taxa de conversão */}
                      <div className="w-16 shrink-0 text-right">
                        {taxa !== null ? (
                          <span
                            className={`text-xs font-semibold ${
                              taxa >= 50
                                ? 'text-emerald-600'
                                : taxa >= 25
                                ? 'text-amber-600'
                                : 'text-red-500'
                            }`}
                          >
                            {taxa}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>

                    {/* Seta de conversão entre etapas */}
                    {index < ETAPAS.length - 1 && taxa !== null && (
                      <div className="flex items-center gap-1 pl-1 text-[10px] text-muted-foreground/60">
                        <span>↓</span>
                        <span>
                          {etapa.label} → {ETAPAS[index + 1].label}: {taxa}% de conversão
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}

              <p className="mt-1 text-[11px] text-muted-foreground/60 text-right">
                Taxa = negócios na etapa ÷ negócios na etapa anterior
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
