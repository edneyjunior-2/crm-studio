'use client'

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { ProcessoCard } from './processo-card'
import { PROCESSO_STATUS, PROCESSO_STATUS_LABEL } from '@/lib/processos-status'

interface Processo {
  id:             string
  numeroProcesso: string
  tribunalSlug:   string
  status:         string
  area:           string | null
  areaLabel:      string | null
  clienteNome:    string | null
  advogadoNome:   string | null
  advogadoId:     string | null
  ultimoUpdate:   string | null
  assunto:        string | null
  vara:           string | null
  qtdNaoLidos:    number
  semDataJud:     boolean
}

// Chave interna 'ativos' mantida para não espalhar renomeação pelo estado/URL —
// o predicado por trás dela agora é 'em_transito' (ver uso abaixo).
export type QuickFilter = 'novas_movimentacoes' | 'ativos' | 'sem_datajud' | null

interface Advogado  { id: string; full_name: string }
interface Tribunal  { slug: string; label: string }
interface AreaOpcao { slug: string; label: string }

const inputClass =
  'h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'

interface Props {
  processos:    Processo[]
  advogados:    Advogado[]
  tribunais:    Tribunal[]
  areaOpcoes:   AreaOpcao[]
  quickFilter:  QuickFilter
  onClearQuick: () => void
}

const QUICK_LABEL: Record<NonNullable<QuickFilter>, string> = {
  novas_movimentacoes: 'Com movimentações novas',
  ativos:              'Em trânsito',
  sem_datajud:         'Sem dados DataJud',
}

export function ProcessosFilter({ processos, advogados, tribunais, areaOpcoes, quickFilter, onClearQuick }: Props) {
  const [q,           setQ]           = useState('')
  const [advogadoId,  setAdvogadoId]  = useState('')
  const [status,      setStatus]      = useState('')
  const [area,        setArea]        = useState('')
  const [tribunal,    setTribunal]    = useState('')

  const filtered = useMemo(() => {
    // Aplica quick filter primeiro
    let base = processos
    if (quickFilter === 'novas_movimentacoes') base = base.filter((p) => p.qtdNaoLidos > 0)
    if (quickFilter === 'ativos')              base = base.filter((p) => p.status === 'em_transito')
    if (quickFilter === 'sem_datajud')         base = base.filter((p) => p.semDataJud)

    const qLow = q.toLowerCase()
    return base.filter((p) => {
      if (q && !p.numeroProcesso.toLowerCase().includes(qLow)
            && !(p.clienteNome?.toLowerCase().includes(qLow))
            && !(p.assunto?.toLowerCase().includes(qLow))) return false
      if (advogadoId && p.advogadoId !== advogadoId) return false
      if (status     && p.status !== status) return false
      if (area       && p.area   !== area)   return false
      if (tribunal   && p.tribunalSlug !== tribunal) return false
      return true
    })
  }, [processos, q, advogadoId, status, area, tribunal, quickFilter])

  const hasFilter = q || advogadoId || status || area || tribunal

  function limpar() {
    setQ(''); setAdvogadoId(''); setStatus(''); setArea(''); setTribunal('')
    onClearQuick()
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Busca livre */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Número, cliente, assunto…"
            className={`${inputClass} w-56`}
          />
        </div>

        {/* Área */}
        {areaOpcoes.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Área</label>
            <select value={area} onChange={(e) => setArea(e.target.value)} className={inputClass}>
              <option value="">Todas as áreas</option>
              {areaOpcoes.map((a) => (
                <option key={a.slug} value={a.slug}>{a.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tribunal */}
        {tribunais.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tribunal</label>
            <select value={tribunal} onChange={(e) => setTribunal(e.target.value)} className={inputClass}>
              <option value="">Todos os tribunais</option>
              {tribunais.map((t) => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {PROCESSO_STATUS.map((v) => (
              <option key={v} value={v}>{PROCESSO_STATUS_LABEL[v]}</option>
            ))}
          </select>
        </div>

        {/* Advogado */}
        {advogados.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Advogado</label>
            <select value={advogadoId} onChange={(e) => setAdvogadoId(e.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {advogados.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Chip do quick filter ativo */}
        {quickFilter && (
          <button
            type="button"
            onClick={onClearQuick}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
          >
            {QUICK_LABEL[quickFilter]}
            <X className="size-3.5" />
          </button>
        )}

        {(hasFilter || quickFilter) && (
          <button
            type="button"
            onClick={limpar}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
            Limpar tudo
          </button>
        )}
      </div>

      {/* Contagem */}
      {hasFilter && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} de {processos.length} processo{processos.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Grade de cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-foreground">
            {hasFilter ? 'Nenhum processo com esses filtros.' : 'Nenhum processo cadastrado ainda.'}
          </p>
          {hasFilter && (
            <button type="button" onClick={limpar} className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
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
