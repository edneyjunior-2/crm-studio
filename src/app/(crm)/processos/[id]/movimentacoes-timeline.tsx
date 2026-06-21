'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Trash2, Loader2 } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'

interface Item {
  id: string
  descricao: string
  complemento: string | null
  data: string
  audiencia: boolean
  isManual: boolean
}
interface Grupo {
  mes: string
  itens: Item[]
}

// Botão de exclusão de movimentação manual com confirmação inline
function DeleteMovButton({ processoId, movId }: { processoId: string; movId: string }) {
  const router = useRouter()
  const [fase, setFase] = useState<'idle' | 'confirm' | 'loading'>('idle')

  async function handleDelete() {
    setFase('loading')
    try {
      await fetch(`/api/processos/${processoId}/movimentacoes/${movId}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      setFase('idle')
    }
  }

  if (fase === 'loading') {
    return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
  }

  if (fase === 'confirm') {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleDelete}
          className="text-[10px] font-semibold text-destructive hover:underline"
        >
          Confirmar
        </button>
        <span className="text-muted-foreground/40">·</span>
        <button
          type="button"
          onClick={() => setFase('idle')}
          className="text-[10px] text-muted-foreground hover:underline"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setFase('confirm')}
      title="Excluir movimentação manual"
      className="shrink-0 rounded p-0.5 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </button>
  )
}

export function MovimentacoesTimeline({
  grupos,
  recenteId,
  processoId,
}: {
  grupos: Grupo[]
  recenteId: string | null
  processoId: string
}) {
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
                {grupo.itens.length} {grupo.itens.length === 1 ? 'movimentação' : 'movimentações'}
              </span>
            </button>

            {aberto && (
              <div className="relative flex flex-col px-4 py-4">
                <div className="absolute left-[33px] top-4 bottom-4 w-px bg-border" aria-hidden />
                {grupo.itens.map((m) => {
                  const recente = m.id === recenteId
                  return (
                    <div key={m.id} className="group relative flex gap-4 pb-4 last:pb-0">
                      {/* Dot da timeline */}
                      <div
                        className={`relative z-10 mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                          recente
                            ? 'border-primary bg-primary/15'
                            : m.audiencia
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950'
                              : m.isManual
                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                                : 'border-border bg-card'
                        }`}
                        aria-hidden
                      />

                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-medium leading-snug ${
                              m.audiencia
                                ? 'text-amber-700 dark:text-amber-400'
                                : m.isManual
                                  ? 'text-blue-700 dark:text-blue-400'
                                  : 'text-foreground'
                            }`}
                          >
                            {m.descricao}
                            {recente && (
                              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                Mais recente
                              </span>
                            )}
                            {m.audiencia && (
                              <StatusBadge variant="humano" className="ml-2 text-[10px] font-semibold">
                                Audiência
                              </StatusBadge>
                            )}
                            {m.isManual && (
                              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                Manual
                              </span>
                            )}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            {m.isManual && (
                              <DeleteMovButton processoId={processoId} movId={m.id} />
                            )}
                            <span className="text-xs text-muted-foreground">{m.data}</span>
                          </div>
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
