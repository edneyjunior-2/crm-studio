'use client'

import { useActionState, useEffect } from 'react'
import { iniciarCheckoutCartao } from './actions'

export function ContinuarButton() {
  const [state, action, isPending] = useActionState(iniciarCheckoutCartao, null)
  const redirecionando = isPending || Boolean(state?.checkoutUrl)

  // Sai do nosso domínio e vai para a página hospedada do Asaas assim que a
  // Server Action retornar a URL do checkout.
  useEffect(() => {
    if (state?.checkoutUrl) {
      window.location.href = state.checkoutUrl
    }
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={redirecionando}
        className="flex w-full items-center justify-center rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-transform hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-60"
      >
        {redirecionando ? 'Redirecionando para o pagamento...' : 'Continuar'}
      </button>
    </form>
  )
}
