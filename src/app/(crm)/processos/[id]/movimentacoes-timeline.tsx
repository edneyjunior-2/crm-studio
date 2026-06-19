'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Item {
  id: string
  descricao: string
  complemento: string | null
  data: string
  audiencia: boolean
}
interface Grupo {
  mes: string
  itens: Item[]
}

export function MovimentacoesTimeline({
  grupos,
  recenteId,
}: {
  grupos: Grupo[]
  recenteId: string | null
}) {
  // Colapsa por MÊS: o mês mais recente (primeiro) fica aberto; os antigos fechados.
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(grupos[0] ? [grupos[0].mes] : []),
  )

  function toggleMes(mes: string) {
    setAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(mes)) next.delete(mes)
      else next.add(mes)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {grupos.map((grupo) => {
        const aberto = abertos.has(grupo.mes)
        return (
          <div key={grupo.mes} className="overflow-hidden rounded-xl border border-border">
            {/* Cabeçalho do mês — clicável para abrir/fechar */}
            <button
              type="button"
              onClick={() => toggleMes(grupo.mes)}
              aria-expanded={aberto}
              className="flex w-full items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/70"
            >
              <span className="flex items-center gap-2">
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${aberto ? '' : '-rotate-90'}`}
                />
                <span className="text-sm font-semibold text-foreground">{grupo.mes}</span>
              </span>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {grupo.itens.length} {grupo.itens.length === 1 ? 'movimentação' : 'movimentações'}
              </span>
            </button>

            {/* Movimentações do mês (visíveis quando o mês está aberto) */}
            {aberto && (
              <div className="relative flex flex-col px-4 py-4">
                <div className="absolute left-[33px] top-4 bottom-4 w-px bg-border" aria-hidden />
                {grupo.itens.map((m) => {
                  const recente = m.id === recenteId
                  return (
                    <div key={m.id} className="relative flex gap-4 pb-4 last:pb-0">
                      <div
                        className={`relative z-10 mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                          recente
                            ? 'border-primary bg-primary/15'
                            : m.audiencia
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950'
                              : 'border-border bg-card'
                        }`}
                        aria-hidden
                      />
                      <div className="flex flex-1 flex-col gap-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-medium leading-snug ${
                              m.audiencia ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                            }`}
                          >
                            {m.descricao}
                            {recente && (
                              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                Mais recente
                              </span>
                            )}
                            {m.audiencia && (
                              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                Audiência
                              </span>
                            )}
                          </p>
                          <span className="shrink-0 text-xs text-muted-foreground">{m.data}</span>
                        </div>
                        {m.complemento && (
                          <p className="text-xs text-muted-foreground">{m.complemento}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
