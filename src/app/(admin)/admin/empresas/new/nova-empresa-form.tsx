'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { criarEmpresa } from '../actions'

export function NovaEmpresaForm() {
  const [state, action, isPending] = useActionState(criarEmpresa, null)
  const [tipoPessoa, setTipoPessoa] = useState<'pj' | 'pf'>('pj')

  const inputClass =
    'rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'

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

      {/* Toggle PJ / PF */}
      <div className="flex rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => setTipoPessoa('pj')}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            tipoPessoa === 'pj'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pessoa Jurídica (CNPJ)
        </button>
        <button
          type="button"
          onClick={() => setTipoPessoa('pf')}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
            tipoPessoa === 'pf'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pessoa Física (CPF)
        </button>
      </div>

      {/* Hidden: tipo_pessoa */}
      <input type="hidden" name="tipo_pessoa" value={tipoPessoa} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="nome">
          {tipoPessoa === 'pj' ? 'Nome da empresa' : 'Nome completo'} *
        </label>
        <input
          id="nome"
          name="nome"
          required
          placeholder={tipoPessoa === 'pj' ? 'Saturnino & Coelho Advogados' : 'Ex.: Ana Paula Ferreira'}
          className={inputClass}
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
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="nome_admin">
          {tipoPessoa === 'pj' ? 'Nome do admin' : 'Nome completo (confirmar)'}
        </label>
        <input
          id="nome_admin"
          name="nome_admin"
          placeholder={tipoPessoa === 'pj' ? 'Ex.: Aislene Saturnino' : 'Ex.: Ana Paula Ferreira'}
          className={inputClass}
        />
      </div>

      {/* Documento: CNPJ (PJ) ou CPF (PF) */}
      {tipoPessoa === 'pj' ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="cnpj">
            CNPJ{' '}
            <span className="font-normal text-muted-foreground">
              (obrigatório para planos pagos)
            </span>
          </label>
          <input
            id="cnpj"
            name="cnpj"
            placeholder="00.000.000/0001-00"
            className={inputClass}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="cpf">
            CPF{' '}
            <span className="font-normal text-muted-foreground">
              (obrigatório para planos pagos)
            </span>
          </label>
          <input
            id="cpf"
            name="cpf"
            placeholder="000.000.000-00"
            className={inputClass}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="plano">
          Modalidade
        </label>
        <select
          id="plano"
          name="plano"
          defaultValue="trial"
          className={inputClass}
        >
          <optgroup label="Sem cobrança">
            <option value="interno">Interno (sem cobrança)</option>
            <option value="trial">Trial — 7 dias grátis</option>
          </optgroup>
          <optgroup label="Planos pagos (cobra via Asaas)">
            <option value="starter">Starter — R$ 149/mês</option>
            <option value="pro">Pro — R$ 449/mês</option>
            <option value="business">Business — R$ 990/mês</option>
          </optgroup>
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
