'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { Search, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { criarProcesso, buscarProcesso } from './actions'
import type { BuscarProcessoResult } from './actions'
import { mascararMilhar, parseValorBR } from '@/lib/honorarios'
import { ClienteForm } from '@/components/crm/clientes/cliente-form'

interface Cliente { id: string; razao_social: string }

interface Props {
  clientes:  Cliente[]
  advogados: { id: string; full_name: string }[]
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

export function NovoProcessoForm({ clientes, advogados }: Props) {
  const [state, action, isPending] = useActionState(criarProcesso, null)

  const [numeroInput, setNumeroInput] = useState('')
  const [buscando, setBuscando]       = useState(false)
  const [dadosDJ, setDadosDJ]         = useState<BuscarProcessoResult | null>(null)
  const [erroDJ, setErroDJ]           = useState<string | null>(null)

  // Cliente: lista mutável (p/ cadastro inline) + seleção controlada
  const [clientesList, setClientesList] = useState<Cliente[]>(clientes)
  const [clienteId, setClienteId]       = useState('')
  const [novoClienteOpen, setNovoClienteOpen] = useState(false)

  // Valor da causa (controlado p/ calcular o honorário em %) + honorários
  const [valorCausa, setValorCausa] = useState('')
  const [honTipo, setHonTipo]       = useState<'percentual' | 'fixo'>('percentual')
  const [honValor, setHonValor]     = useState('')

  const valorCausaNum = parseValorBR(valorCausa)
  const honValorNum   = parseFloat((honValor || '').replace(',', '.'))
  const honorarioCalc =
    honTipo === 'percentual' && !Number.isNaN(valorCausaNum) && !Number.isNaN(honValorNum)
      ? (valorCausaNum * honValorNum) / 100
      : null

  function handleNovoClienteSuccess(cliente: { id: string; razao_social: string }) {
    setClientesList((prev) =>
      [...prev, cliente].sort((a, b) => a.razao_social.localeCompare(b.razao_social, 'pt-BR')),
    )
    setClienteId(cliente.id)
    setNovoClienteOpen(false)
  }

  async function handleBuscar() {
    if (!numeroInput.trim()) return
    setBuscando(true)
    setErroDJ(null)
    setDadosDJ(null)

    try {
      const resultado = await buscarProcesso(numeroInput.trim())
      if ('erro' in resultado) {
        setErroDJ(resultado.erro ?? 'Erro desconhecido.')
      } else {
        setDadosDJ(resultado)
      }
    } catch {
      setErroDJ('Não foi possível consultar o DataJud agora. Tente novamente.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <form
      action={action}
      className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6"
    >
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Número do processo + botão buscar */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="numero_processo">
          Número do processo (CNJ) *
        </label>
        <div className="flex gap-2">
          <input
            id="numero_processo"
            name="numero_processo"
            required
            value={numeroInput}
            onChange={(e) => setNumeroInput(e.target.value)}
            placeholder="0000000-00.0000.0.00.0000"
            className={inputClass}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleBuscar() } }}
          />
          <button
            type="button"
            onClick={handleBuscar}
            disabled={buscando || !numeroInput.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
          >
            {buscando
              ? <Loader2 className="size-4 animate-spin" />
              : <Search className="size-4" />}
            Buscar DataJud
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Clique em &quot;Buscar DataJud&quot; para preencher automaticamente os dados do processo.
        </p>
      </div>

      {/* Aviso DataJud */}
      {erroDJ && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Consulta ao DataJud</p>
            <p className="mt-0.5 text-xs">{erroDJ}</p>
          </div>
        </div>
      )}

      {dadosDJ && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium">Dados carregados do DataJud</span>
            {' · '}Tribunal: {dadosDJ.tribunalSlug.toUpperCase()}
            {dadosDJ.movimentos.length > 0 && ` · ${dadosDJ.movimentos.length} movimentações`}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Assunto */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelClass} htmlFor="assunto">Assunto</label>
          <input
            id="assunto"
            name="assunto"
            defaultValue={dadosDJ?.assunto ?? ''}
            key={dadosDJ?.assunto}
            placeholder="Ex.: Rescisão contratual"
            className={inputClass}
          />
        </div>

        {/* Vara */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="vara">Vara</label>
          <input
            id="vara"
            name="vara"
            defaultValue={dadosDJ?.vara ?? ''}
            key={dadosDJ?.vara}
            placeholder="Ex.: 1ª Vara Cível"
            className={inputClass}
          />
        </div>

        {/* Comarca */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="comarca">Comarca</label>
          <input
            id="comarca"
            name="comarca"
            defaultValue={dadosDJ?.comarca ?? ''}
            key={dadosDJ?.comarca}
            placeholder="Ex.: Salvador"
            className={inputClass}
          />
        </div>

        {/* Área do direito */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="area">Área do direito</label>
          <select
            id="area"
            name="area"
            defaultValue={dadosDJ?.area ?? ''}
            key={dadosDJ?.area ?? 'sem-area'}
            className={inputClass}
          >
            <option value="">Selecionar...</option>
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          {dadosDJ?.area && (
            <p className="text-xs text-muted-foreground">
              Preenchido automaticamente pelo DataJud — ajuste se necessário.
            </p>
          )}
        </div>

        {/* Valor da causa */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="valor_causa">Valor da causa (R$)</label>
          <input
            id="valor_causa"
            name="valor_causa"
            type="text"
            inputMode="numeric"
            value={valorCausa}
            onChange={(e) => setValorCausa(mascararMilhar(e.target.value))}
            placeholder="Ex.: 80.000"
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">Valor total da causa (mantido p/ relatórios).</p>
        </div>

        {/* Honorários do advogado */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelClass}>Honorários do advogado</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="honorarios_tipo"
              value={honTipo}
              onChange={(e) => setHonTipo(e.target.value as 'percentual' | 'fixo')}
              className={`${inputClass} sm:max-w-[220px]`}
            >
              <option value="percentual">Percentual da causa (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </select>
            <input
              name="honorarios_valor"
              type="number"
              step="0.01"
              min="0"
              value={honValor}
              onChange={(e) => setHonValor(e.target.value)}
              placeholder={honTipo === 'percentual' ? 'Ex.: 20 (= 20%)' : 'Ex.: 5000,00'}
              className={inputClass}
            />
          </div>
          {honTipo === 'percentual' && (
            honorarioCalc != null ? (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Honorário previsto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(honorarioCalc)}
                {' '}({honValor}% de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorCausaNum)})
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Informe o valor da causa e a porcentagem para calcular o honorário.
              </p>
            )
          )}
        </div>

        {/* Cliente (com cadastro inline via Dialog) */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cliente_id">Cliente</label>
          <select
            id="cliente_id"
            name="cliente_id"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className={inputClass}
          >
            <option value="">Nenhum</option>
            {clientesList.map((c) => (
              <option key={c.id} value={c.id}>{c.razao_social}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setNovoClienteOpen(true)}
            className="self-start text-sm text-primary hover:underline cursor-pointer"
          >
            Novo cliente +
          </button>
          <ClienteForm
            open={novoClienteOpen}
            onOpenChange={setNovoClienteOpen}
            onSuccess={handleNovoClienteSuccess}
          />
        </div>

        {/* Advogado responsável */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="advogado_id">Advogado responsável</label>
          <select id="advogado_id" name="advogado_id" className={inputClass}>
            <option value="">Nenhum</option>
            {advogados.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
        >
          {isPending ? 'Salvando...' : 'Salvar processo'}
        </button>
        <Link
          href="/processos"
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
