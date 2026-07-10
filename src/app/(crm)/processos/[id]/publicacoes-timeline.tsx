'use client'

import { useState } from 'react'
import { ChevronDown, ArrowUpRight } from 'lucide-react'

interface PublicacaoItem {
  id:       string
  tribunal: string
  tipo:     string
  texto:    string
  data:     string
  link:     string | null
}
interface Grupo {
  mes:   string
  itens: PublicacaoItem[]
}

// Timeline agrupada por mês (acordeão) — mesmo padrão visual de
// movimentacoes-timeline.tsx. Publicações do DJEN são só leitura (sem
// exclusão/edição manual), por isso não há botão de ação por item.
export function PublicacoesTimeline({ grupos }: { grupos: Grupo[] }) {
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
            {/* Cabeçalho do mês */}
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
                {grupo.itens.length} {grupo.itens.length === 1 ? 'publicação' : 'publicações'}
              </span>
            </button>

            {aberto && (
              <div className="relative flex flex-col px-4 py-4">
                <div className="absolute left-[33px] top-4 bottom-4 w-px bg-border" aria-hidden />
                {grupo.itens.map((p) => (
                  <div key={p.id} className="group relative flex gap-4 pb-4 last:pb-0">
                    {/* Dot da timeline */}
                    <div
                      className="relative z-10 mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-border bg-card"
                      aria-hidden
                    />

                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{p.tribunal}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {p.tipo}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{p.data}</span>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                        {p.texto}
                      </p>
                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Ver no tribunal
                          <ArrowUpRight className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
