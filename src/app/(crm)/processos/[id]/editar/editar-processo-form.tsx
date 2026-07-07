'use client'

import { useActionState, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { atualizarProcesso } from '../actions'
import { mascararMilhar, parseValorBR, valorParaMascara } from '@/lib/honorarios'

interface ProcessoEdit {
  id: string
  assunto: string | null
  area: string | null
  vara: string | null
  comarca: string | null
  valor_causa: number | null
  honorarios_tipo: string | null
  honorarios_valor: number | null
  cliente_id: string | null
  advogado_id: string | null
  parceiro_id: string | null
  polo_passivo_nome:        string | null
  polo_passivo_cpf_cnpj:    string | null
  advogado_adversario_nome: string | null
  advogado_adversario_oab:  string | null
}

interface Props {
  processo:  ProcessoEdit
  clientes:  { id: string; razao_social: string }[]
  advogados: { id: string; full_name: string }[]
  parceiros: { id: string; full_name: string }[]
}

const AREAS = [
  { value: 'civel',          label: 'Cível' },
  { value: 'trabalhista',    label: 'Trabalhista' },
  { value: 'criminal',       label: 'Criminal' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'tributario',     label: 'Tributário' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'familia',        label: 'Família e Sucessões' },
  { value: 'outro',          label: 'Outro' },
]

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const labelClass = 'text-sm font-medium text-foreground'
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function EditarProcessoForm({ processo, clientes, advogados, parceiros }: Props) {
  const [state, action, isPending] = useActionState(atualizarProcesso, null)

  const [valorCausa, setValorCausa] = useState(valorParaMascara(processo.valor_causa))
  const [honTipo, setHonTipo] = useState<'percentual' | 'fixo'>(
    processo.honorarios_tipo === 'fixo' ? 'fixo' : 'percentual',
  )
  const [honValor, setHonValor] = useState(processo.honorarios_valor != null ? String(processo.honorarios_valor) : '')

  const valorCausaNum = parseValorBR(valorCausa)
  const honValorNum   = parseFloat((honValor || '').replace(',', '.'))
  const honorarioCalc =
    honTipo === 'percentual' && !Number.isNaN(valorCausaNum) && !Number.isNaN(honValorNum)
      ? (valorCausaNum * honValorNum) / 100
      : null

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <input type="hidden" name="processo_id" value={processo.id} />

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelClass} htmlFor="assunto">Assunto</label>
          <input id="assunto" name="assunto" defaultValue={processo.assunto ?? ''} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="vara">Vara</label>
          <input id="vara" name="vara" defaultValue={processo.vara ?? ''} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="comarca">Comarca</label>
          <input id="comarca" name="comarca" defaultValue={processo.comarca ?? ''} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="area">Área do direito</label>
          <select id="area" name="area" defaultValue={processo.area ?? ''} className={inputClass}>
            <option value="">Selecionar...</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="valor_causa">Valor da causa (R$)</label>
          <input
            id="valor_causa" name="valor_causa" type="text" inputMode="numeric"
            value={valorCausa} onChange={(e) => setValorCausa(mascararMilhar(e.target.value))}
            placeholder="Ex.: 80.000" className={inputClass}
          />
          <p className="text-xs text-muted-foreground">Valor total da causa (mantido p/ relatórios).</p>
        </div>

        {/* Honorários */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelClass}>Honorários do advogado</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="honorarios_tipo" value={honTipo}
              onChange={(e) => setHonTipo(e.target.value as 'percentual' | 'fixo')}
              className={`${inputClass} sm:max-w-[220px]`}
            >
              <option value="percentual">Percentual da causa (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </select>
            <input
              name="honorarios_valor" type="number" step="0.01" min="0"
              value={honValor} onChange={(e) => setHonValor(e.target.value)}
              placeholder={honTipo === 'percentual' ? 'Ex.: 20 (= 20%)' : 'Ex.: 5000,00'}
              className={inputClass}
            />
          </div>
          {honTipo === 'percentual' && (
            honorarioCalc != null ? (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Honorário previsto: {brl(honorarioCalc)} ({honValor}% de {brl(valorCausaNum)})
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Informe o valor da causa e a porcentagem para calcular o honorário.
              </p>
            )
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cliente_id">Cliente</label>
          <select id="cliente_id" name="cliente_id" defaultValue={processo.cliente_id ?? ''} className={inputClass}>
            <option value="">Nenhum</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="advogado_id">Advogado responsável</label>
          <select id="advogado_id" name="advogado_id" defaultValue={processo.advogado_id ?? ''} className={inputClass}>
            <option value="">Nenhum</option>
            {advogados.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
        </div>

        {/* Parceiro — quem trouxe o processo (opcional) */}
        {parceiros.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="parceiro_id">Parceiro (indicação)</label>
            <select id="parceiro_id" name="parceiro_id" defaultValue={processo.parceiro_id ?? ''} className={inputClass}>
              <option value="">Nenhum</option>
              {parceiros.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">
              Quem trouxe este processo. Ele passa a ver este processo no portal dele (só leitura).
            </p>
          </div>
        )}

        {/* Polo passivo */}
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:col-span-2">
          <p className="text-sm font-semibold text-foreground">Polo passivo (parte adversa)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="polo_passivo_nome">Nome da parte adversa</label>
              <input
                id="polo_passivo_nome" name="polo_passivo_nome"
                defaultValue={processo.polo_passivo_nome ?? ''}
                placeholder="Razão social ou nome completo"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="polo_passivo_cpf_cnpj">CPF / CNPJ</label>
              <input
                id="polo_passivo_cpf_cnpj" name="polo_passivo_cpf_cnpj"
                defaultValue={processo.polo_passivo_cpf_cnpj ?? ''}
                placeholder="Opcional"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="advogado_adversario_nome">Advogado adversário</label>
              <input
                id="advogado_adversario_nome" name="advogado_adversario_nome"
                defaultValue={processo.advogado_adversario_nome ?? ''}
                placeholder="Nome do advogado"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="advogado_adversario_oab">OAB do adversário</label>
              <input
                id="advogado_adversario_oab" name="advogado_adversario_oab"
                defaultValue={processo.advogado_adversario_oab ?? ''}
                placeholder="Ex.: SP 123456"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit" disabled={isPending}
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
        >
          {isPending ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <a
          href={`/processos/${processo.id}`}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Cancelar
        </a>
      </div>
    </form>
  )
}
