'use client'

import { useActionState } from 'react'
import { criarEmpresa } from '../actions'

export function NovaEmpresaForm() {
  const [state, action, isPending] = useActionState(criarEmpresa, null)

  return (
    <form
      action={action}
      className="flex max-w-lg flex-col gap-5 rounded-xl border border-border bg-card p-6"
    >
      {state?.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="nome">
          Nome da empresa *
        </label>
        <input
          id="nome"
          name="nome"
          required
          placeholder="Saturnino & Coelho Advogados"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="email">
          E-mail do admin *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="admin@empresa.com.br"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="nome_admin">
          Nome do admin
        </label>
        <input
          id="nome_admin"
          name="nome_admin"
          placeholder="Ex.: Aislene Saturnino"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="plano">
          Plano inicial
        </label>
        <select
          id="plano"
          name="plano"
          defaultValue="starter"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
        >
          <option value="free">Free</option>
          <option value="starter">Starter — R$ 149/mês</option>
          <option value="pro">Pro — R$ 449/mês</option>
          <option value="business">Business — R$ 990/mês</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? 'Criando...' : 'Criar empresa e usuário admin'}
      </button>
    </form>
  )
}
