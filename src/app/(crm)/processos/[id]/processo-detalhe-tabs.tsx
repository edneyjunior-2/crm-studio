'use client'

import { useState } from 'react'
import { FileText, ClipboardList } from 'lucide-react'
import { MovimentacoesTimeline } from './movimentacoes-timeline'
import { NovaMovimentacaoDialog } from './nova-movimentacao-dialog'
import { HistoricoInterno } from './historico-interno'
import { AlertCircle } from 'lucide-react'

interface Item {
  id: string
  descricao: string
  complemento: string | null
  data: string
  audiencia: boolean
  isManual: boolean
}
interface Grupo {
  mes: string
  itens: Item[]
}
interface MovInternaItem {
  id: string
  assunto: string
  descricao: string | null
  created_at: string
  autor_nome: string | null
}

interface Props {
  processoId:    string
  gruposTimeline: Grupo[]
  recenteId:     string | null
  totalMov:      number
  movInternas:   MovInternaItem[]
}

type Aba = 'movimentacoes' | 'interno'

export function ProcessoDetalheTabs({
  processoId,
  gruposTimeline,
  recenteId,
  totalMov,
  movInternas,
}: Props) {
  const [aba, setAba] = useState<Aba>('movimentacoes')

  const tabCls = (t: Aba) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      aba === t
        ? 'border-foreground text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
    }`

  return (
    <div className="flex flex-col gap-0">
      {/* Barra de abas */}
      <div className="flex items-center gap-0 border-b border-border">
        <button type="button" className={tabCls('movimentacoes')} onClick={() => setAba('movimentacoes')}>
          <FileText className="size-4" />
          Movimentações
          {totalMov > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              aba === 'movimentacoes' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {totalMov}
            </span>
          )}
        </button>

        <button type="button" className={tabCls('interno')} onClick={() => setAba('interno')}>
          <ClipboardList className="size-4" />
          Histórico Interno
          {movInternas.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              aba === 'interno' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {movInternas.length}
            </span>
          )}
        </button>
      </div>

      {/* Conteúdo da aba Movimentações */}
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
                O cron buscará atualizações via DataJud. Para processos não indexados, use o botão acima para registrar manualmente.
              </p>
            </div>
          ) : (
            <MovimentacoesTimeline grupos={gruposTimeline} recenteId={recenteId} processoId={processoId} />
          )}
        </div>
      )}

      {/* Conteúdo da aba Histórico Interno */}
      {aba === 'interno' && (
        <div className="pt-4">
          <HistoricoInterno processoId={processoId} movimentacoes={movInternas} />
        </div>
      )}
    </div>
  )
}
