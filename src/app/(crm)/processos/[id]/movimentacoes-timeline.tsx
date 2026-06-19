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
  // Por padrão só a mais recente fica aberta; as antigas ficam fechadas.
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(recenteId ? [recenteId] : []),
  )

  function toggle(id: string) {
    setAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {grupos.map((grupo) => (
        <div key={grupo.mes} className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {grupo.mes}
          </p>
          <div className="relative flex flex-col">
            <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" aria-hidden />
            {grupo.itens.map((m) => {
              const recente = m.id === recenteId
              const aberto = abertos.has(m.id)
              const temDetalhe = !!m.complemento

              return (
                <div key={m.id} className="relative flex gap-4 pb-3 last:pb-0">
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

                  <div className="flex flex-1 flex-col">
                    <button
                      type="button"
                      onClick={() => temDetalhe && toggle(m.id)}
                      aria-expanded={temDetalhe ? aberto : undefined}
                      className={`flex w-full items-start justify-between gap-2 text-left ${
                        temDetalhe ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <span className="flex min-w-0 items-start gap-1.5">
                        {temDetalhe ? (
                          <ChevronDown
                            className={`mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform ${
                              aberto ? '' : '-rotate-90'
                            }`}
                          />
                        ) : (
                          <span className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        )}
                        <span
                          className={`text-sm font-medium leading-snug ${
                            m.audiencia ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                          } ${aberto ? '' : 'line-clamp-1'}`}
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
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{m.data}</span>
                    </button>

                    {temDetalhe && aberto && (
                      <p className="mt-1 pl-5 text-xs text-muted-foreground">{m.complemento}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
