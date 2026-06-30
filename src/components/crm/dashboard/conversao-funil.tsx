'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import { corPorTipo, type EstagioPipeline } from '@/lib/estagios-ui'

interface ConversaoFunilProps {
  estagios: EstagioPipeline[]
  contagens: Record<string, number>
}

export function ConversaoFunil({ estagios, contagens }: ConversaoFunilProps) {
  const [aberto, setAberto] = useState(false)

  // Etapas do funil: abertas em ordem + a etapa ganho no fim (perdido excluído)
  const etapasAberto = estagios.filter((e) => e.tipo === 'aberto')
  const etapaGanho = estagios.find((e) => e.tipo === 'ganho')
  const etapasFunil: EstagioPipeline[] = etapaGanho
    ? [...etapasAberto, etapaGanho]
    : etapasAberto

  const valores = etapasFunil.map((e) => contagens[e.slug] ?? 0)
  const maxValor = Math.max(...valores, 1)

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
              {etapasFunil.map((etapa, index) => {
                const qtd = valores[index]
                const qtdAnterior = index === 0 ? null : valores[index - 1]

                const taxa =
                  qtdAnterior !== null && qtdAnterior > 0
                    ? Math.round((qtd / qtdAnterior) * 100)
                    : null

                const larguraPercent = maxValor > 0 ? Math.max((qtd / maxValor) * 100, qtd > 0 ? 8 : 3) : 3

                const { dot, texto } = corPorTipo(etapa.tipo)

                return (
                  <div key={etapa.slug} className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-7 bg-muted/40 rounded-md overflow-hidden">
                        <div
                          className={`h-full rounded-md transition-all duration-500 ${dot} ${qtd === 0 ? 'opacity-20' : 'opacity-85'}`}
                          style={{ width: `${larguraPercent}%` }}
                        />
                      </div>

                      <span className={`w-28 shrink-0 text-xs font-medium ${texto}`}>
                        {etapa.nome}
                      </span>

                      <span className="w-8 shrink-0 text-right text-sm font-bold text-foreground">
                        {qtd}
                      </span>

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

                    {index < etapasFunil.length - 1 && taxa !== null && (
                      <div className="flex items-center gap-1 pl-1 text-[10px] text-muted-foreground/60">
                        <span>↓</span>
                        <span>
                          {etapa.nome} → {etapasFunil[index + 1].nome}: {taxa}% de conversão
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
