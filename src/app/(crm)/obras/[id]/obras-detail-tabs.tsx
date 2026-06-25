'use client'

import { useState } from 'react'
import { EtapasSection } from './etapas-section'
import { MedicoesSection } from './medicoes-section'
import type { Etapa } from './etapas-section'
import type { Medicao } from './medicoes-section'

interface Props {
  obraId:      string
  etapas:      Etapa[]
  medicoes:    Medicao[]
  podeExcluir: boolean
}

export function ObraDetailTabs({ obraId, etapas, medicoes, podeExcluir }: Props) {
  const [tab, setTab] = useState<'etapas' | 'medicoes'>('etapas')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('etapas')}
          className={
            tab === 'etapas'
              ? 'rounded-md bg-background px-4 py-1.5 text-sm font-medium shadow-sm text-foreground'
              : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'
          }
        >
          Etapas ({etapas.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('medicoes')}
          className={
            tab === 'medicoes'
              ? 'rounded-md bg-background px-4 py-1.5 text-sm font-medium shadow-sm text-foreground'
              : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'
          }
        >
          Medições ({medicoes.length})
        </button>
      </div>

      {tab === 'etapas' && (
        <EtapasSection obraId={obraId} etapas={etapas} podeExcluir={podeExcluir} />
      )}
      {tab === 'medicoes' && (
        <MedicoesSection obraId={obraId} medicoes={medicoes} podeExcluir={podeExcluir} />
      )}
    </div>
  )
}
