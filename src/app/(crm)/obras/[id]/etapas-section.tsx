'use client'

import { useState, useTransition } from 'react'
import { ChevronRight, Plus, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { atualizarStatusEtapa, excluirEtapa, criarEtapa } from '../actions'

export interface Etapa {
  id: string
  nome: string
  descricao: string | null
  status: string
  percentual_obra: number | null
  valor: number | null
  data_previsao: string | null
  data_conclusao: string | null
  ordem: number
}

interface Props {
  obraId:      string
  etapas:      Etapa[]
  podeExcluir: boolean
}

const STATUS_ETAPA_LABEL: Record<string, string> = {
  pendente:     'Pendente',
  em_andamento: 'Em andamento',
  concluida:    'Concluída',
}

const STATUS_ETAPA_CLASS: Record<string, string> = {
  pendente:     'bg-muted text-muted-foreground',
  em_andamento: 'bg-blue-500/10 text-blue-600',
  concluida:    'bg-green-500/10 text-green-700',
}

const PROXIMO_STATUS: Record<string, string> = {
  pendente:     'em_andamento',
  em_andamento: 'concluida',
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

export function EtapasSection({ obraId, etapas: etapasInicial, podeExcluir }: Props) {
  const [etapas, setEtapas]           = useState<Etapa[]>(etapasInicial)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erroGlobal, setErroGlobal]   = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  // Novo-etapa form state
  const [novoNome, setNovoNome]           = useState('')
  const [novoDesc, setNovoDesc]           = useState('')
  const [novoPerc, setNovoPerc]           = useState('')
  const [novoValor, setNovoValor]         = useState('')
  const [novoData, setNovoData]           = useState('')
  const [salvando, setSalvando]           = useState(false)
  const [erroForm, setErroForm]           = useState<string | null>(null)

  function avancarStatus(etapa: Etapa) {
    const proximo = PROXIMO_STATUS[etapa.status]
    if (!proximo) return

    startTransition(async () => {
      setErroGlobal(null)
      const res = await atualizarStatusEtapa(etapa.id, obraId, proximo)
      if (res.error) {
        setErroGlobal(res.error)
        return
      }
      setEtapas((prev) =>
        prev.map((e) => (e.id === etapa.id ? { ...e, status: proximo } : e)),
      )
    })
  }

  function removerEtapa(etapa: Etapa) {
    if (!confirm(`Excluir etapa "${etapa.nome}"?`)) return

    startTransition(async () => {
      setErroGlobal(null)
      const res = await excluirEtapa(etapa.id, obraId)
      if (res.error) {
        setErroGlobal(res.error)
        return
      }
      setEtapas((prev) => prev.filter((e) => e.id !== etapa.id))
    })
  }

  async function handleSalvarEtapa(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) { setErroForm('Nome é obrigatório.'); return }

    setSalvando(true)
    setErroForm(null)

    const percNum  = novoPerc  ? parseFloat(novoPerc.replace(',', '.'))  : null
    const valorNum = novoValor ? parseFloat(novoValor.replace(/\./g, '').replace(',', '.')) : null

    const res = await criarEtapa(obraId, {
      nome:            novoNome.trim(),
      descricao:       novoDesc.trim() || null,
      percentual_obra: percNum != null && !Number.isNaN(percNum) ? percNum : null,
      valor:           valorNum != null && !Number.isNaN(valorNum) ? valorNum : null,
      data_previsao:   novoData || null,
      ordem:           etapas.length + 1,
    })

    setSalvando(false)

    if (res.error) { setErroForm(res.error); return }

    // Recarrega a lista otimisticamente com dados mínimos
    setEtapas((prev) => [
      ...prev,
      {
        id:              crypto.randomUUID(),
        nome:            novoNome.trim(),
        descricao:       novoDesc.trim() || null,
        status:          'pendente',
        percentual_obra: percNum ?? null,
        valor:           valorNum ?? null,
        data_previsao:   novoData || null,
        data_conclusao:  null,
        ordem:           etapas.length + 1,
      },
    ])

    setNovoNome('')
    setNovoDesc('')
    setNovoPerc('')
    setNovoValor('')
    setNovoData('')
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

      {etapas.length === 0 && !mostrarForm && (
        <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
      )}

      {etapas.map((etapa) => (
        <div
          key={etapa.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{etapa.nome}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_ETAPA_CLASS[etapa.status] ?? 'bg-muted text-muted-foreground'}`}>
                {STATUS_ETAPA_LABEL[etapa.status] ?? etapa.status}
              </span>
            </div>
            {etapa.descricao && (
              <p className="text-xs text-muted-foreground line-clamp-2">{etapa.descricao}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {etapa.percentual_obra != null && <span>{etapa.percentual_obra}% da obra</span>}
              {etapa.valor != null && (
                <span>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(etapa.valor)}
                </span>
              )}
              {etapa.data_previsao && <span>Previsão: {formatarData(etapa.data_previsao)}</span>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {PROXIMO_STATUS[etapa.status] && (
              <button
                type="button"
                onClick={() => avancarStatus(etapa)}
                disabled={isPending}
                title={`Avançar para ${STATUS_ETAPA_LABEL[PROXIMO_STATUS[etapa.status]]}`}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                {isPending ? <Loader2 className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
                Avançar
              </button>
            )}
            {podeExcluir && (
              <button
                type="button"
                onClick={() => removerEtapa(etapa)}
                disabled={isPending}
                title="Excluir etapa"
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
          onSubmit={handleSalvarEtapa}
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4"
        >
          <p className="text-sm font-semibold text-foreground">Nova etapa</p>

          {erroForm && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {erroForm}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Nome *</label>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: Fundação"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Descrição</label>
            <input
              value={novoDesc}
              onChange={(e) => setNovoDesc(e.target.value)}
              placeholder="Opcional"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>% da obra</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={novoPerc}
                onChange={(e) => setNovoPerc(e.target.value)}
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
            <label className={labelClass}>Previsão</label>
            <input
              type="date"
              value={novoData}
              onChange={(e) => setNovoData(e.target.value)}
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
          Nova etapa
        </button>
      )}
    </div>
  )
}
