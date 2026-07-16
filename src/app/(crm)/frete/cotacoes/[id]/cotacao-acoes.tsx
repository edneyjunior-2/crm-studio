'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Send, CheckCircle, Truck, PackageCheck, Ban, RotateCcw } from 'lucide-react'
import { atualizarStatusCotacao } from '../actions'

const STATUS_TRANSICOES: Record<string, { label: string; novoStatus: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  rascunho:  [{ label: 'Enviar cotação', novoStatus: 'enviada',   icon: Send }],
  enviada: [
    { label: 'Aprovar',  novoStatus: 'aprovada',  icon: CheckCircle },
    { label: 'Cancelar', novoStatus: 'cancelada', icon: Ban },
  ],
  aprovada: [
    { label: 'Iniciar viagem', novoStatus: 'em_viagem', icon: Truck },
    { label: 'Cancelar',       novoStatus: 'cancelada', icon: Ban },
  ],
  em_viagem: [{ label: 'Concluir viagem', novoStatus: 'concluida', icon: PackageCheck }],
  concluida: [{ label: 'Reabrir', novoStatus: 'rascunho', icon: RotateCcw }],
  cancelada: [{ label: 'Reabrir', novoStatus: 'rascunho', icon: RotateCcw }],
}

interface Props {
  cotacaoId:   string
  statusAtual: string
}

export function CotacaoAcoes({ cotacaoId, statusAtual }: Props) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [isPending, startTransition]  = useTransition()
  const [erro, setErro]               = useState<string | null>(null)

  const transicoes = STATUS_TRANSICOES[statusAtual] ?? []

  function handleStatus(novoStatus: string) {
    setOpen(false)
    setErro(null)
    startTransition(async () => {
      const res = await atualizarStatusCotacao(cotacaoId, novoStatus)
      if (res.error) setErro(res.error)
      else router.refresh()
    })
  }

  if (transicoes.length === 0) return null

  return (
    <div className="relative">
      {erro && (
        <p className="absolute right-10 top-0 whitespace-nowrap text-xs text-destructive">{erro}</p>
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
          </div>
        </>
      )}
    </div>
  )
}
