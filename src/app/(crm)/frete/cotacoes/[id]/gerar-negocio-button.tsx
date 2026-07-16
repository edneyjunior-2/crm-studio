'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Handshake, Loader2 } from 'lucide-react'
import { gerarNegocioDaCotacao } from './gerar-negocio-actions'

interface Props {
  cotacaoId: string
}

export function GerarNegocioButton({ cotacaoId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function handleClick() {
    setErro(null)
    startTransition(async () => {
      const res = await gerarNegocioDaCotacao(cotacaoId)
      if (res.error) setErro(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Handshake className="size-4" />}
        Gerar negócio no pipeline
      </button>
    </div>
  )
}
