'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle } from 'lucide-react'
import { criarObra } from './actions'
import { ClienteForm } from '@/components/crm/clientes/cliente-form'
import { EnderecoAutocomplete } from '@/components/crm/endereco-autocomplete'

interface Cliente { id: string; razao_social: string }
interface Responsavel { id: string; full_name: string }

interface Props {
  clientes:     Cliente[]
  responsaveis: Responsavel[]
}

const TIPOS = [
  { value: 'residencial',    label: 'Residencial' },
  { value: 'comercial',      label: 'Comercial' },
  { value: 'industrial',     label: 'Industrial' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'reforma',        label: 'Reforma' },
  { value: 'outro',          label: 'Outro' },
]

const STATUS_OPCOES = [
  { value: 'orcamento',    label: 'Orçamento' },
  { value: 'em_andamento', label: 'Em andamento' },
]

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const labelClass = 'text-sm font-medium text-foreground'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50'
const btnSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted'

export function NovaObraForm({ clientes, responsaveis }: Props) {
  const [state, action, isPending] = useActionState(criarObra, null)
  const router = useRouter()

  // Cliente: lista mutável (para cadastro inline) + seleção controlada
  const [clientesList, setClientesList] = useState<Cliente[]>(clientes)
  const [clienteId, setClienteId]       = useState('')
  const [novoClienteOpen, setNovoClienteOpen] = useState(false)

  // Endereço controlado (preenchido pelo autocomplete do Google)
  const [endereco, setEndereco] = useState('')
  const [cidade,   setCidade]   = useState('')
  const [estado,   setEstado]   = useState('')

  function handleNovoClienteSuccess(cliente: { id: string; razao_social: string }) {
    setClientesList((prev) =>
      [...prev, cliente].sort((a, b) => a.razao_social.localeCompare(b.razao_social, 'pt-BR')),
    )
    setClienteId(cliente.id)
    setNovoClienteOpen(false)
  }

  useEffect(() => {
    if (state?.id) router.push(`/obras/${state.id}`)
  }, [state?.id, router])

  function formatarMilhar(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(raw)
    if (!Number.isNaN(num)) {
      e.target.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
    }
  }

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Nome */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="nome">Nome da obra *</label>
        <input
          id="nome"
          name="nome"
          required
          placeholder="Ex.: Residencial Vila Nova — Bloco A"
          className={inputClass}
        />
      </div>

      {/* Tipo */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="tipo">Tipo</label>
        <select id="tipo" name="tipo" className={inputClass}>
          <option value="">Selecione…</option>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Cliente */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className={labelClass} htmlFor="cliente_id">Cliente</label>
          <button
            type="button"
            onClick={() => setNovoClienteOpen(true)}
            className="text-xs text-primary hover:underline cursor-pointer font-medium"
          >
            + Novo cliente
          </button>
        </div>
        <select
          id="cliente_id"
          name="cliente_id"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className={inputClass}
        >
          <option value="">Selecione…</option>
          {clientesList.map((c) => (
            <option key={c.id} value={c.id}>{c.razao_social}</option>
          ))}
        </select>
        <ClienteForm
          open={novoClienteOpen}
          onOpenChange={setNovoClienteOpen}
          onSuccess={handleNovoClienteSuccess}
        />
      </div>

      {/* Responsável */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="responsavel_id">Responsável</label>
        <select id="responsavel_id" name="responsavel_id" className={inputClass}>
          <option value="">Selecione…</option>
          {responsaveis.map((r) => (
            <option key={r.id} value={r.id}>{r.full_name}</option>
          ))}
        </select>
      </div>

      {/* Endereço */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Endereço</label>
        <EnderecoAutocomplete
          placeholder="Buscar endereço no Google…"
          onSelect={(d) => {
            setEndereco(d.endereco)
            setCidade(d.cidade)
            setEstado(d.estado)
          }}
        />
        <input
          id="endereco"
          name="endereco"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Rua, número, bairro"
          className={inputClass}
        />
      </div>

      {/* Cidade + Estado */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cidade">Cidade</label>
          <input
            id="cidade"
            name="cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex.: Florianópolis"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="estado">Estado</label>
          <input
            id="estado"
            name="estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            placeholder="Ex.: SC"
            maxLength={2}
            className={inputClass}
          />
        </div>
      </div>

      {/* Valor do contrato */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="valor_contrato">Valor do contrato (R$)</label>
        <input
          id="valor_contrato"
          name="valor_contrato"
          inputMode="decimal"
          placeholder="0,00"
          onBlur={formatarMilhar}
          className={inputClass}
        />
      </div>

      {/* Data início + Data previsão término */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="data_inicio">Data de início</label>
          <input id="data_inicio" name="data_inicio" type="date" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="data_previsao_termino">Previsão de término</label>
          <input id="data_previsao_termino" name="data_previsao_termino" type="date" className={inputClass} />
        </div>
      </div>

      {/* ART nº */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="art_numero">ART nº</label>
        <input
          id="art_numero"
          name="art_numero"
          placeholder="Número da ART/RRT"
          className={inputClass}
        />
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="status">Status</label>
        <select id="status" name="status" className={inputClass} defaultValue="orcamento">
          {STATUS_OPCOES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Descrição */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="descricao">Descrição</label>
        <textarea
          id="descricao"
          name="descricao"
          rows={3}
          placeholder="Detalhes adicionais sobre a obra…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar obra
        </button>
        <Link href="/obras" className={btnSecondary}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
