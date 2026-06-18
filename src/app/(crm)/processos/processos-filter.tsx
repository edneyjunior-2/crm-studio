'use client'

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { ProcessoCard } from './processo-card'

interface Processo {
  id:                   string
  numeroProcesso:       string
  tribunalSlug:         string
  status:               string
  clienteNome:          string | null
  advogadoNome:         string | null
  advogadoId:           string | null
  ultimoUpdate:         string | null
  assunto:              string | null
  vara:                 string | null
  qtdNaoLidos:          number
}

interface Advogado {
  id:        string
  full_name: string
}

const STATUS_LABEL: Record<string, string> = {
  ativo:     'Ativo',
  encerrado: 'Encerrado',
  suspenso:  'Suspenso',
  arquivado: 'Arquivado',
}

const inputClass =
  'h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'

interface Props {
  processos:  Processo[]
  advogados:  Advogado[]
}

export function ProcessosFilter({ processos, advogados }: Props) {
  const [q,          setQ]          = useState('')
  const [advogadoId, setAdvogadoId] = useState('')
  const [status,     setStatus]     = useState('')

  const filtered = useMemo(() => {
    return processos.filter((p) => {
      if (q && !p.numeroProcesso.toLowerCase().includes(q.toLowerCase())) return false
      if (advogadoId && p.advogadoId !== advogadoId) return false
      if (status && p.status !== status) return false
      return true
    })
  }, [processos, q, advogadoId, status])

  const hasFilter = q || advogadoId || status

  return (
    <>
      {/* Filtros inline — filtram em tempo real sem recarregar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Número do processo..."
            className={`${inputClass} w-56`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Advogado</label>
          <select
            value={advogadoId}
            onChange={(e) => setAdvogadoId(e.target.value)}
            className={inputClass}
          >
            <option value="">Todos</option>
            {advogados.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={() => { setQ(''); setAdvogadoId(''); setStatus('') }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Grade de cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-foreground">
            {hasFilter ? 'Nenhum processo encontrado com esses filtros.' : 'Nenhum processo cadastrado ainda.'}
          </p>
          {hasFilter && (
            <button
              type="button"
              onClick={() => { setQ(''); setAdvogadoId(''); setStatus('') }}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Remover filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProcessoCard
              key={p.id}
              id={p.id}
              numeroProcesso={p.numeroProcesso}
              tribunalSlug={p.tribunalSlug}
              status={p.status}
              clienteNome={p.clienteNome}
              advogadoNome={p.advogadoNome}
              ultimoUpdate={p.ultimoUpdate}
              assunto={p.assunto}
              vara={p.vara}
              qtdNaoLidos={p.qtdNaoLidos}
            />
          ))}
        </div>
      )}
    </>
  )
}
