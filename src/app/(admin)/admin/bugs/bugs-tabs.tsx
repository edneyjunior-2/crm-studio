'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Inbox, CheckCircle2 } from 'lucide-react'

interface Props {
  totalAtivos:     number
  totalResolvidos: number
}

// Mesmo padrão de src/app/(crm)/processos/processos-tabs.tsx (segmented tabs
// via ?tab= na URL) — reaproveitado aqui pra separar reports ativos do
// histórico de resolvidos.
export function BugsTabs({ totalAtivos, totalResolvidos }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const tab    = params.get('tab') ?? 'ativos'

  function irPara(t: string) {
    const p = new URLSearchParams(params.toString())
    if (t === 'ativos') p.delete('tab')
    else p.set('tab', t)
    router.push(`/admin/bugs${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
      <button
        type="button"
        onClick={() => irPara('ativos')}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          tab === 'ativos'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Inbox className="size-4" />
        Reports
        {totalAtivos > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            tab === 'ativos' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {totalAtivos}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => irPara('historico')}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          tab === 'historico'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <CheckCircle2 className="size-4" />
        Histórico de resolvidos
        {totalResolvidos > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            tab === 'historico' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-muted text-muted-foreground'
          }`}>
            {totalResolvidos}
          </span>
        )}
      </button>
    </div>
  )
}
