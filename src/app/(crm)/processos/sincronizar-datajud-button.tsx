'use client'

import { RefreshCw } from 'lucide-react'
import { useSyncDataJud } from '@/components/crm/sync-datajud-provider'

export function SincronizarDataJudButton() {
  const { running, iniciar } = useSyncDataJud()

  return (
    <button
      type="button"
      onClick={iniciar}
      disabled={running}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
    >
      <RefreshCw className={`size-3.5 ${running ? 'animate-spin' : ''}`} />
      {running ? 'Sincronizando…' : 'Sincronizar DataJud'}
    </button>
  )
}
