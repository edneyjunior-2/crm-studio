'use client'

import { useState } from 'react'
import { FileText, ClipboardList, Paperclip, CalendarClock, AlertCircle } from 'lucide-react'
import { MovimentacoesTimeline } from './movimentacoes-timeline'
import { NovaMovimentacaoDialog } from './nova-movimentacao-dialog'
import { HistoricoInterno } from './historico-interno'
import { DocumentosSection } from './documentos-section'
import { PrazosSection } from './prazos-section'
import type { DocItem } from './doc-actions'

interface TimelineItem {
  id:          string
  descricao:   string
  complemento: string | null
  data:        string
  audiencia:   boolean
  isManual:    boolean
  futura:      boolean
}
interface Grupo {
  mes:   string
  itens: TimelineItem[]
}
interface MovInternaItem {
  id:         string
  assunto:    string
  descricao:  string | null
  created_at: string
  autor_nome: string | null
}
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

interface Props {
  processoId:     string
  gruposTimeline: Grupo[]
  recenteId:      string | null
  totalMov:       number
  movInternas:    MovInternaItem[]
  documentos:     DocItem[]
  prazos:         Prazo[]
  membros:        Membro[]
}

type Aba = 'movimentacoes' | 'interno' | 'documentos' | 'prazos'

export function ProcessoDetalheTabs({
  processoId,
  gruposTimeline,
  recenteId,
  totalMov,
  movInternas,
  documentos,
  prazos,
  membros,
}: Props) {
  const [aba, setAba] = useState<Aba>('movimentacoes')

  const tabCls = (t: Aba) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      aba === t
        ? 'border-foreground text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
    }`

  const badge = (count: number, active: boolean) =>
    count > 0 ? (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {count}
      </span>
    ) : null

  const prazosPendentes = prazos.filter((p) => !p.cumprido).length

  return (
    <div className="flex flex-col gap-0">
      {/* Barra de abas com scroll horizontal em mobile */}
      <div className="flex items-center gap-0 overflow-x-auto border-b border-border">
        <button type="button" className={tabCls('movimentacoes')} onClick={() => setAba('movimentacoes')}>
          <FileText className="size-4 shrink-0" />
          Movimentações
          {badge(totalMov, aba === 'movimentacoes')}
        </button>

        <button type="button" className={tabCls('interno')} onClick={() => setAba('interno')}>
          <ClipboardList className="size-4 shrink-0" />
          Histórico Interno
          {badge(movInternas.length, aba === 'interno')}
        </button>

        <button type="button" className={tabCls('prazos')} onClick={() => setAba('prazos')}>
          <CalendarClock className="size-4 shrink-0" />
          Prazos
          {prazosPendentes > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              aba === 'prazos' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {prazosPendentes}
            </span>
          )}
        </button>

        <button type="button" className={tabCls('documentos')} onClick={() => setAba('documentos')}>
          <Paperclip className="size-4 shrink-0" />
          Documentos
          {badge(documentos.length, aba === 'documentos')}
        </button>
      </div>

      {/* Movimentações DataJud */}
      {aba === 'movimentacoes' && (
        <div className="flex flex-col gap-3 pt-4">
          <div className="flex items-center justify-end">
            <NovaMovimentacaoDialog processoId={processoId} />
          </div>
          {gruposTimeline.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="size-4 shrink-0" />
                Nenhuma movimentação registrada ainda.
              </div>
              <p className="text-xs text-muted-foreground">
                O cron buscará atualizações via DataJud. Para processos não indexados, use o botão acima.
              </p>
            </div>
          ) : (
            <MovimentacoesTimeline grupos={gruposTimeline} recenteId={recenteId} processoId={processoId} />
          )}
        </div>
      )}

      {/* Histórico Interno */}
      {aba === 'interno' && (
        <div className="pt-4">
          <HistoricoInterno processoId={processoId} movimentacoes={movInternas} />
        </div>
      )}

      {/* Prazos processuais */}
      {aba === 'prazos' && (
        <div className="pt-4">
          <PrazosSection processoId={processoId} prazos={prazos} membros={membros} />
        </div>
      )}

      {/* Documentos (GED) */}
      {aba === 'documentos' && (
        <div className="pt-4">
          <DocumentosSection processoId={processoId} documentos={documentos} />
        </div>
      )}
    </div>
  )
}
