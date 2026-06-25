'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Check, Loader2, CalendarClock } from 'lucide-react'
import { criarPrazo, marcarPrazoCumprido, excluirPrazo } from './prazos-actions'

interface Prazo {
  id:               string
  descricao:        string
  data_prazo:       string
  cumprido:         boolean
  responsavel_id:   string | null
  responsavel_nome: string | null
}

interface Membro {
  id:    string
  nome:  string
  email: string
}

function BadgePrazo({ dataPrazo, cumprido }: { dataPrazo: string; cumprido: boolean }) {
  if (cumprido) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Cumprido
      </span>
    )
  }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(dataPrazo + 'T00:00:00')
  const diff = Math.ceil((data.getTime() - hoje.getTime()) / 86400000)
  if (diff < 0) {
    return (
      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        Vencido há {Math.abs(diff)}d
      </span>
    )
  }
  if (diff === 0) {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Hoje
      </span>
    )
  }
  if (diff <= 7) {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Em {diff}d
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {new Date(dataPrazo + 'T00:00:00').toLocaleDateString('pt-BR')}
    </span>
  )
}

interface Props {
  processoId: string
  prazos:     Prazo[]
  membros:    Membro[]
}

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40'

export function PrazosSection({ processoId, prazos: inicial, membros }: Props) {
  const [prazos, setPrazos]         = useState(inicial)
  const [showForm, setShowForm]     = useState(false)
  const [descricao, setDescricao]   = useState('')
  const [dataPrazo, setDataPrazo]   = useState('')
  const [respId, setRespId]         = useState('')
  const [erro, setErro]             = useState<string | null>(null)
  const [saving, startSave]         = useTransition()
  const [toggling, startToggle]     = useTransition()
  const [deleting, startDelete]     = useTransition()

  function handleSalvar() {
    setErro(null)
    startSave(async () => {
      const res = await criarPrazo(processoId, descricao, dataPrazo, respId || undefined)
      if (res.error) { setErro(res.error); return }
      setDescricao(''); setDataPrazo(''); setRespId(''); setShowForm(false)
    })
  }

  function handleToggle(prazoId: string, cumprido: boolean) {
    startToggle(async () => {
      const res = await marcarPrazoCumprido(prazoId, processoId, !cumprido)
      if (res.error) return
      setPrazos((p) => p.map((x) => x.id === prazoId ? { ...x, cumprido: !cumprido } : x))
    })
  }

  function handleDelete(prazoId: string) {
    if (!confirm('Excluir este prazo?')) return
    startDelete(async () => {
      const res = await excluirPrazo(prazoId, processoId)
      if (res.error) return
      setPrazos((p) => p.filter((x) => x.id !== prazoId))
    })
  }

  const pendentes  = prazos.filter((p) => !p.cumprido)
  const cumpridos  = prazos.filter((p) => p.cumprido)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pendentes.length === 0
            ? 'Nenhum prazo pendente'
            : `${pendentes.length} prazo${pendentes.length !== 1 ? 's' : ''} pendente${pendentes.length !== 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="size-3.5" />
          Novo prazo
        </button>
      </div>

      {showForm && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Descrição do prazo</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Prazo para contestação"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data fatal</label>
              <input
                type="date"
                value={dataPrazo}
                onChange={(e) => setDataPrazo(e.target.value)}
                className={inputClass}
              />
            </div>
            {membros.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Responsável (opcional)</label>
                <select value={respId} onChange={(e) => setRespId(e.target.value)} className={inputClass}>
                  <option value="">Nenhum</option>
                  {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
            )}
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSalvar}
              disabled={saving || !descricao.trim() || !dataPrazo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {saving ? 'Salvando…' : 'Salvar prazo'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {prazos.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <CalendarClock className="size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum prazo cadastrado</p>
          <p className="text-xs text-muted-foreground">Adicione prazos processuais para acompanhar os vencimentos.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {[...pendentes, ...cumpridos].map((prazo) => (
            <li
              key={prazo.id}
              className={`flex items-start gap-3 px-4 py-3 ${prazo.cumprido ? 'opacity-60' : ''}`}
            >
              <button
                type="button"
                onClick={() => handleToggle(prazo.id, prazo.cumprido)}
                disabled={toggling}
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  prazo.cumprido
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border bg-background hover:border-foreground/40'
                }`}
                title={prazo.cumprido ? 'Marcar como pendente' : 'Marcar como cumprido'}
              >
                {prazo.cumprido && <Check className="size-2.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${prazo.cumprido ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {prazo.descricao}
                </p>
                {prazo.responsavel_nome && (
                  <p className="text-[11px] text-muted-foreground">Resp.: {prazo.responsavel_nome}</p>
                )}
              </div>
              <BadgePrazo dataPrazo={prazo.data_prazo} cumprido={prazo.cumprido} />
              <button
                onClick={() => handleDelete(prazo.id)}
                disabled={deleting}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                title="Excluir prazo"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
