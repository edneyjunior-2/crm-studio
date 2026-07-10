'use client'

import { RefreshCw } from 'lucide-react'
import { useSyncDjen } from '@/components/crm/sync-djen-provider'

export function SincronizarDjenButton({ processoId }: { processoId: string }) {
  const { running, iniciar } = useSyncDjen()

  return (
    <button
      type="button"
      onClick={() => iniciar(processoId)}
      disabled={running}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
    >
      <RefreshCw className={`size-3.5 ${running ? 'animate-spin' : ''}`} />
      {running ? 'Sincronizando…' : 'Sincronizar DJEN'}
    </button>
  )
}
