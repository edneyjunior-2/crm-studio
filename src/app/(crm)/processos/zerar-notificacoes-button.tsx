'use client'

import { useState } from 'react'
import { BellOff, Check, Loader2 } from 'lucide-react'

interface Props {
  totalNaoLidos: number
}

export function ZerarNotificacoesButton({ totalNaoLidos }: Props) {
  const [fase,    setFase]    = useState<'idle' | 'confirm' | 'loading' | 'done'>('idle')

  if (totalNaoLidos === 0 || fase === 'done') return null

  async function confirmar() {
    setFase('loading')
    try {
      await fetch('/api/processos/marcar-tudo-lido', { method: 'POST' })
    } catch { /* silencioso — reload resolve */ }
    setFase('done')
    // Pequeno delay para o usuário ver o checkmark antes de recarregar
    setTimeout(() => window.location.reload(), 800)
  }

  if (fase === 'confirm') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">
          Zerar {totalNaoLidos.toLocaleString('pt-BR')} notificaç{totalNaoLidos !== 1 ? 'ões' : 'ão'}?
        </span>
        <button
          type="button"
          onClick={confirmar}
          className="h-7 rounded-md bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => setFase('idle')}
          className="h-7 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          Cancelar
        </button>
      </div>
    )
  }

  if (fase === 'loading') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Zerando…
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setFase('confirm')}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
    >
      <BellOff className="size-3.5" />
      Zerar notificações
    </button>
  )
}
