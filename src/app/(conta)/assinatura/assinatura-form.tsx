'use client'

import { useActionState } from 'react'
import { assinarPlano } from './actions'

const PLANOS = [
  { value: 'starter', nome: 'Starter',  preco: 'R$ 149/mês' },
  { value: 'pro',     nome: 'Pro',       preco: 'R$ 449/mês' },
  { value: 'business',nome: 'Business', preco: 'R$ 990/mês' },
]

export function AssinaturaForm() {
  const [state, action, isPending] = useActionState(assinarPlano, null)

  if (state?.success) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Assinatura criada! Verifique seu e-mail com o link de pagamento do Asaas.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Após o pagamento ser confirmado, seu acesso é liberado automaticamente.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="mt-8 flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold">Assinar agora</h2>

      {state?.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {/* Seleção de plano */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Selecione o plano</legend>
        <div className="flex flex-wrap gap-2">
          {PLANOS.map((plano) => (
            <label
              key={plano.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm hover:border-foreground/40 has-[:checked]:border-foreground has-[:checked]:bg-foreground/5"
            >
              <input
                type="radio"
                name="plano"
                value={plano.value}
                defaultChecked={plano.value === 'starter'}
                className="accent-foreground"
                required
              />
              <span className="font-medium">{plano.nome}</span>
              <span className="text-muted-foreground">{plano.preco}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* CNPJ opcional */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="cnpj-form">
          CNPJ <span className="font-normal">(opcional)</span>
        </label>
        <input
          id="cnpj-form"
          name="cnpj"
          placeholder="00.000.000/0001-00"
          className="max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? 'Processando...' : 'Assinar e receber link de pagamento'}
      </button>

      <p className="text-xs text-muted-foreground">
        Você receberá um e-mail com o link de pagamento. Após confirmar, o acesso é liberado automaticamente.
      </p>
    </form>
  )
}
