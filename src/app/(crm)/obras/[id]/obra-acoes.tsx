'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Archive, CheckCircle, RotateCcw, PauseCircle, Trash2, PlayCircle } from 'lucide-react'
import { atualizarStatusObra, deletarObra } from '../actions'

const STATUS_TRANSICOES: Record<string, { label: string; novoStatus: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  orcamento:    [{ label: 'Iniciar obra',   novoStatus: 'em_andamento', icon: PlayCircle  }],
  em_andamento: [
    { label: 'Pausar obra',   novoStatus: 'pausada',      icon: PauseCircle  },
    { label: 'Concluir obra', novoStatus: 'concluida',    icon: CheckCircle  },
    { label: 'Cancelar obra', novoStatus: 'cancelada',    icon: Archive      },
  ],
  pausada: [
    { label: 'Retomar obra',  novoStatus: 'em_andamento', icon: PlayCircle  },
    { label: 'Cancelar obra', novoStatus: 'cancelada',    icon: Archive      },
  ],
  concluida:  [{ label: 'Reabrir obra',  novoStatus: 'em_andamento', icon: RotateCcw }],
  cancelada:  [{ label: 'Reativar obra', novoStatus: 'em_andamento', icon: RotateCcw }],
}

interface Props {
  obraId:      string
  statusAtual: string
  podeExcluir: boolean
}

export function ObraAcoes({ obraId, statusAtual, podeExcluir }: Props) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erro, setErro]         = useState<string | null>(null)

  const transicoes = STATUS_TRANSICOES[statusAtual] ?? []

  function handleStatus(novoStatus: string) {
    setOpen(false)
    setErro(null)
    startTransition(async () => {
      const res = await atualizarStatusObra(obraId, novoStatus)
      if (res.error) setErro(res.error)
      else router.refresh()
    })
  }

  function handleDeletar() {
    if (!confirm('Excluir esta obra permanentemente? Esta ação não pode ser desfeita.')) return
    setOpen(false)
    startTransition(async () => {
      const res = await deletarObra(obraId)
      if (res.error) setErro(res.error)
    })
  }

  if (transicoes.length === 0 && !podeExcluir) return null

  return (
    <div className="relative">
      {erro && (
        <p className="absolute right-10 top-0 text-xs text-destructive whitespace-nowrap">{erro}</p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 min-w-[180px] rounded-xl border border-border bg-popover shadow-lg py-1">
            {transicoes.map(({ label, novoStatus, icon: Icon }) => (
              <button
                key={novoStatus}
                type="button"
                onClick={() => handleStatus(novoStatus)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </button>
            ))}
            {podeExcluir && (
              <button
                type="button"
                onClick={handleDeletar}
                className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/5 mt-1"
              >
                <Trash2 className="size-4" />
                Excluir obra
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
