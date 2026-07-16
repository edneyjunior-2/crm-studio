'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { criarEmpresa } from '../actions'
import { PLANO_LABEL, precoFormatado } from '@/lib/planos'

// Só os 3 planos que criarEmpresa() aceita hoje (o Zod da action valida
// starter/pro/business). Verticais (advocacia/engenharia) são vendidas no
// /cadastro; aqui o admin usa "Área de atuação" para o mesmo efeito.
const PLANOS_PAGOS = ['starter', 'pro', 'business'] as const

const TIPOS_ATUACAO = [
  { value: 'vendas',     label: 'CRM de Vendas',    desc: 'Pipeline, clientes, financeiro, contratos' },
  { value: 'advocacia',  label: 'CRM Advocacia',    desc: 'Tudo + Processos Jurídicos (DataJud)' },
  { value: 'engenharia', label: 'CRM Engenharia',   desc: 'Tudo + Obras, equipe e ponto diário' },
  { value: 'frete',      label: 'CRM Frete e Logística', desc: 'Tudo + Calculadora ANTT, veículos e motoristas' },
]

export function NovaEmpresaForm() {
  const [state, action, isPending] = useActionState(criarEmpresa, null)
  const [tipoPessoa,  setTipoPessoa]  = useState<'pj' | 'pf'>('pj')
  const [tipoAtuacao, setTipoAtuacao] = useState<string>('vendas')

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
      <input type="hidden" name="tipo_atuacao" value={tipoAtuacao} />

      {/* Tipo de atuação */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Tipo de atuação</label>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_ATUACAO.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipoAtuacao(t.value)}
              className={`flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors ${
                tipoAtuacao === t.value
                  ? 'border-foreground bg-foreground/5'
                  : 'border-border hover:border-foreground/30'
              }`}
            >
              <span className={`text-sm font-semibold ${tipoAtuacao === t.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                {t.label}
              </span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

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
            <option value="trial">Trial — 14 dias grátis</option>
          </optgroup>
          <optgroup label="Planos pagos (cobra via Asaas)">
            {/* Preço de src/lib/planos.ts — este select cobra de verdade. */}
            {PLANOS_PAGOS.map((p) => (
              <option key={p} value={p}>
                {PLANO_LABEL[p]} — {precoFormatado(p)}/mês
              </option>
            ))}
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
