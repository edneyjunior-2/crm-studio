'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, XCircle } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import type { NegocioComRelacoes } from '@/types'

interface MotivosPerdaProps {
  negocios: NegocioComRelacoes[]
}

export function MotivosPerda({ negocios }: MotivosPerdaProps) {
  const [aberto, setAberto] = useState(false)

  const perdidos = negocios.filter((n) => n.estagio === 'fechado_perdido')

  if (perdidos.length === 0) return null

  // Conta ocorrências de cada motivo
  const contagemMotivos: Record<string, number> = {}
  let semMotivo = 0

  for (const negocio of perdidos) {
    if (negocio.motivo_perda) {
      contagemMotivos[negocio.motivo_perda] =
        (contagemMotivos[negocio.motivo_perda] ?? 0) + 1
    } else {
      semMotivo++
    }
  }

  // Ordena por frequência (maior primeiro)
  const motivos = Object.entries(contagemMotivos).sort(([, a], [, b]) => b - a)

  const totalComMotivo = motivos.reduce((s, [, v]) => s + v, 0)
  const total = perdidos.length

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <XCircle className="size-4 text-red-400" />
          <span className="text-sm font-semibold text-foreground">Motivos de Perda</span>
          <StatusBadge variant="atrasado" className="h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold">
            {total}
          </StatusBadge>
        </div>
        {aberto
          ? <ChevronUp className="size-4 text-muted-foreground" />
          : <ChevronDown className="size-4 text-muted-foreground" />
        }
      </button>

      {aberto && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          {motivos.length === 0 && semMotivo > 0 ? (
            <p className="text-sm text-muted-foreground">
              {total} {total === 1 ? 'negócio perdido' : 'negócios perdidos'} sem motivo registrado.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {motivos.map(([motivo, qtd]) => {
                const percentual = total > 0 ? Math.round((qtd / total) * 100) : 0
                return (
                  <div key={motivo} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground flex-1 truncate">{motivo}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-red-600">{qtd}x</span>
                        <span className="text-xs text-muted-foreground">({percentual}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-400 transition-all duration-500"
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              {semMotivo > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2 mt-1">
                  <span>Sem motivo registrado</span>
                  <span>{semMotivo}x</span>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground/60 text-right mt-1">
                Total: {total} {total === 1 ? 'negócio perdido' : 'negócios perdidos'}
                {semMotivo > 0 && ` · ${totalComMotivo} com motivo`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
