'use client'

import { useState } from 'react'
import { ProcessosDashboard } from './processos-dashboard'
import { ProcessosFilter, type QuickFilter } from './processos-filter'
import { ZerarNotificacoesButton } from './zerar-notificacoes-button'
import type { ProcessoStats } from './processos-dashboard'

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

interface Advogado  { id: string; full_name: string }
interface Tribunal  { slug: string; label: string }
interface AreaOpcao { slug: string; label: string }

interface Props {
  stats:      ProcessoStats
  processos:  Processo[]
  advogados:  Advogado[]
  tribunais:  Tribunal[]
  areaOpcoes: AreaOpcao[]
}

export function ProcessosPageContent({ stats, processos, advogados, tribunais, areaOpcoes }: Props) {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null)

  return (
    <>
      <ProcessosDashboard
        stats={stats}
        quickFilter={quickFilter}
        onFilter={setQuickFilter}
      />

      <div className="border-t border-border" />

      {/* Linha de ação acima dos filtros */}
      {stats.totalNaoLidos > 0 && (
        <div className="flex items-center justify-end">
          <ZerarNotificacoesButton totalNaoLidos={stats.totalNaoLidos} />
        </div>
      )}

      <ProcessosFilter
        processos={processos}
        advogados={advogados}
        tribunais={tribunais}
        areaOpcoes={areaOpcoes}
        quickFilter={quickFilter}
        onClearQuick={() => setQuickFilter(null)}
      />
    </>
  )
}
