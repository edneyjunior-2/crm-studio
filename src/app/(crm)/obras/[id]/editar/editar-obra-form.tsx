'use client'

import { useActionState } from 'react'
import { AlertCircle } from 'lucide-react'
import { atualizarObra } from '../../actions'

const TIPOS = [
  { value: 'residencial',    label: 'Residencial' },
  { value: 'comercial',      label: 'Comercial' },
  { value: 'industrial',     label: 'Industrial' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'reforma',        label: 'Reforma' },
  { value: 'outro',          label: 'Outro' },
]

const STATUS_OPTIONS = [
  { value: 'orcamento',    label: 'Orçamento' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'pausada',      label: 'Pausada' },
  { value: 'concluida',    label: 'Concluída' },
  { value: 'cancelada',    label: 'Cancelada' },
]

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

interface Obra {
  id: string; nome: string; tipo: string | null; status: string
  valor_contrato: number | null; data_inicio: string | null; data_previsao_termino: string | null
  endereco: string | null; cidade: string | null; estado: string | null
  art_numero: string | null; descricao: string | null
  cliente_id: string | null; responsavel_id: string | null
}

interface Props {
  obra:         Obra
  clientes:     { id: string; razao_social: string }[]
  responsaveis: { id: string; full_name: string }[]
}

const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const lbl = 'text-sm font-medium text-foreground'

export function EditarObraForm({ obra, clientes, responsaveis }: Props) {
  const [state, action, isPending] = useActionState(atualizarObra, null)

  const valorInicial = obra.valor_contrato != null
    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(obra.valor_contrato)
    : ''

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <input type="hidden" name="obra_id" value={obra.id} />

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={lbl} htmlFor="nome">Nome da obra *</label>
          <input id="nome" name="nome" required defaultValue={obra.nome} className={inp} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={obra.tipo ?? ''} className={inp}>
            <option value="">Selecionar…</option>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={obra.status} className={inp}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="cliente_id">Cliente</label>
          <select id="cliente_id" name="cliente_id" defaultValue={obra.cliente_id ?? ''} className={inp}>
            <option value="">Nenhum</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="responsavel_id">Responsável</label>
          <select id="responsavel_id" name="responsavel_id" defaultValue={obra.responsavel_id ?? ''} className={inp}>
            <option value="">Nenhum</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={lbl} htmlFor="valor_contrato">Valor do contrato (R$)</label>
          <input id="valor_contrato" name="valor_contrato" type="text" inputMode="decimal"
            defaultValue={valorInicial} className={inp} placeholder="Ex.: 250.000,00" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="data_inicio">Data de início</label>
          <input id="data_inicio" name="data_inicio" type="date" defaultValue={obra.data_inicio ?? ''} className={inp} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="data_previsao_termino">Previsão de término</label>
          <input id="data_previsao_termino" name="data_previsao_termino" type="date" defaultValue={obra.data_previsao_termino ?? ''} className={inp} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={lbl} htmlFor="endereco">Endereço da obra</label>
          <input id="endereco" name="endereco" defaultValue={obra.endereco ?? ''} className={inp} placeholder="Rua, número, bairro…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" defaultValue={obra.cidade ?? ''} className={inp} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={obra.estado ?? ''} className={inp}>
            <option value="">UF</option>
            {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={lbl} htmlFor="art_numero">Nº da ART / RRT</label>
          <input id="art_numero" name="art_numero" defaultValue={obra.art_numero ?? ''} className={inp} placeholder="Opcional" />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={lbl} htmlFor="descricao">Descrição / Observações</label>
          <textarea id="descricao" name="descricao" rows={3} defaultValue={obra.descricao ?? ''}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60">
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </button>
        <a href={`/obras/${obra.id}`}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
          Cancelar
        </a>
      </div>
    </form>
  )
}
