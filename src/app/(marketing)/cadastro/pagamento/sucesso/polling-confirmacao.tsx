'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Race condition conhecida: o redirect do Asaas pra esta página pode chegar
// ANTES do webhook (SUBSCRIPTION_CREATED) processar e virar o status da
// empresa pra 'trial'. Em vez de travar/errar, faz um polling leve chamando
// router.refresh() (que reexecuta o Server Component e relê o status real do
// banco) até MAX_TENTATIVAS vezes; se esgotar, mostra uma mensagem de espera
// em vez de ficar girando pra sempre.
const MAX_TENTATIVAS = 3
const INTERVALO_MS = 1500

export function PollingConfirmacao() {
  const router = useRouter()
  const [tentativa, setTentativa] = useState(0)
  const esgotado = tentativa >= MAX_TENTATIVAS

  useEffect(() => {
    if (esgotado) return
    const timer = setTimeout(() => {
      router.refresh()
      setTentativa((t) => t + 1)
    }, INTERVALO_MS)
    return () => clearTimeout(timer)
  }, [tentativa, esgotado, router])

  if (esgotado) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Isso pode levar alguns segundos — atualize a página.
      </p>
    )
  }

  return (
    <p className="mt-4 text-sm text-muted-foreground">
      Confirmando com o Asaas...
    </p>
  )
}
