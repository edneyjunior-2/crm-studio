'use client'

import { useState, useTransition } from 'react'
import { ChevronRight, Plus, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { criarMedicao, atualizarStatusMedicao, excluirMedicao } from '../actions'

export interface Medicao {
  id:             string
  numero_medicao: number
  descricao:      string
  status:         string
  percentual:     number | null
  valor:          number | null
  data_medicao:   string | null
  observacoes:    string | null
}

interface Props {
  obraId:      string
  medicoes:    Medicao[]
  podeExcluir: boolean
}

const STATUS_MEDICAO_LABEL: Record<string, string> = {
  pendente:  'Pendente',
  aprovada:  'Aprovada',
  faturada:  'Faturada',
}

const STATUS_MEDICAO_CLASS: Record<string, string> = {
  pendente: 'bg-muted text-muted-foreground',
  aprovada: 'bg-blue-500/10 text-blue-600',
  faturada: 'bg-green-500/10 text-green-700',
}

const PROXIMO_STATUS: Record<string, string> = {
  pendente: 'aprovada',
  aprovada: 'faturada',
}

function formatarData(data: string | null): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return data
  return `${dia}/${mes}/${ano}`
}

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const labelClass = 'text-sm font-medium text-foreground'

export function MedicoesSection({ obraId, medicoes: medicoesInicial, podeExcluir }: Props) {
  const [medicoes, setMedicoes]       = useState<Medicao[]>(medicoesInicial)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erroGlobal, setErroGlobal]   = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const [novaDesc, setNovaDesc]   = useState('')
  const [novaPerc, setNovaPerc]   = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [novaData, setNovaData]   = useState('')
  const [salvando, setSalvando]   = useState(false)
  const [erroForm, setErroForm]   = useState<string | null>(null)

  function avancarStatus(medicao: Medicao) {
    const proximo = PROXIMO_STATUS[medicao.status]
    if (!proximo) return

    startTransition(async () => {
      setErroGlobal(null)
      const res = await atualizarStatusMedicao(medicao.id, obraId, proximo)
      if (res.error) { setErroGlobal(res.error); return }
      setMedicoes((prev) =>
        prev.map((m) => (m.id === medicao.id ? { ...m, status: proximo } : m)),
      )
    })
  }

  function removerMedicao(medicao: Medicao) {
    if (!confirm(`Excluir medição #${medicao.numero_medicao}?`)) return

    startTransition(async () => {
      setErroGlobal(null)
      const res = await excluirMedicao(medicao.id, obraId)
      if (res.error) { setErroGlobal(res.error); return }
      setMedicoes((prev) => prev.filter((m) => m.id !== medicao.id))
    })
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!novaDesc.trim()) { setErroForm('Descrição é obrigatória.'); return }

    setSalvando(true)
    setErroForm(null)

    const percNum  = novaPerc  ? parseFloat(novaPerc.replace(',', '.'))  : null
    const valorNum = novoValor ? parseFloat(novoValor.replace(/\./g, '').replace(',', '.')) : null

    const res = await criarMedicao(obraId, {
      descricao:   novaDesc.trim(),
      percentual:  percNum != null && !Number.isNaN(percNum) ? percNum : null,
      valor:       valorNum != null && !Number.isNaN(valorNum) ? valorNum : null,
      data_medicao: novaData || null,
    })

    setSalvando(false)

    if (res.error) { setErroForm(res.error); return }

    const proximoNumero = (medicoes[medicoes.length - 1]?.numero_medicao ?? 0) + 1
    setMedicoes((prev) => [
      ...prev,
      {
        id:             crypto.randomUUID(),
        numero_medicao: proximoNumero,
        descricao:      novaDesc.trim(),
        status:         'pendente',
        percentual:     percNum ?? null,
        valor:          valorNum ?? null,
        data_medicao:   novaData || null,
        observacoes:    null,
      },
    ])

    setNovaDesc('')
    setNovaPerc('')
    setNovoValor('')
    setNovaData('')
    setMostrarForm(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {erroGlobal && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {erroGlobal}
        </div>
      )}

      {medicoes.length === 0 && !mostrarForm && (
        <p className="text-sm text-muted-foreground">Nenhuma medição cadastrada.</p>
      )}

      {medicoes.map((medicao) => (
        <div
          key={medicao.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">#{medicao.numero_medicao}</span>
              <span className="text-sm font-medium text-foreground">{medicao.descricao}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_MEDICAO_CLASS[medicao.status] ?? 'bg-muted text-muted-foreground'}`}>
                {STATUS_MEDICAO_LABEL[medicao.status] ?? medicao.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {medicao.percentual != null && <span>{medicao.percentual}% medido</span>}
              {medicao.valor != null && (
                <span>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(medicao.valor)}
                </span>
              )}
              {medicao.data_medicao && <span>{formatarData(medicao.data_medicao)}</span>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {PROXIMO_STATUS[medicao.status] && (
              <button
                type="button"
                onClick={() => avancarStatus(medicao)}
                disabled={isPending}
                title={`Avançar para ${STATUS_MEDICAO_LABEL[PROXIMO_STATUS[medicao.status]]}`}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                {isPending ? <Loader2 className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
                Avançar
              </button>
            )}
            {podeExcluir && (
              <button
                type="button"
                onClick={() => removerMedicao(medicao)}
                disabled={isPending}
                title="Excluir medição"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      {mostrarForm && (
        <form
          onSubmit={handleSalvar}
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4"
        >
          <p className="text-sm font-semibold text-foreground">Nova medição</p>

          {erroForm && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {erroForm}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Descrição *</label>
            <input
              value={novaDesc}
              onChange={(e) => setNovaDesc(e.target.value)}
              placeholder="Ex.: Medição de fundação completa"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>% medido</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={novaPerc}
                onChange={(e) => setNovaPerc(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Valor (R$)</label>
              <input
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                placeholder="0,00"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Data da medição</label>
            <input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-50"
            >
              {salvando && <Loader2 className="size-3.5 animate-spin" />}
              Salvar
            </button>
            <button
              type="button"
              onClick={() => { setMostrarForm(false); setErroForm(null) }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!mostrarForm && (
        <button
          type="button"
          onClick={() => setMostrarForm(true)}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-4" />
          Nova medição
        </button>
      )}
    </div>
  )
}
