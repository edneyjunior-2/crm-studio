'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Scale, Archive } from 'lucide-react'

interface Props {
  totalAtivos:    number
  totalArquivados: number
}

export function ProcessosTabs({ totalAtivos, totalArquivados }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const tab    = params.get('tab') ?? 'ativos'

  function irPara(t: string) {
    const p = new URLSearchParams(params.toString())
    if (t === 'ativos') p.delete('tab')
    else p.set('tab', t)
    router.push(`/processos${p.size ? `?${p}` : ''}`)
  }

  return (
    <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
      <button
        type="button"
        onClick={() => irPara('ativos')}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          tab === 'ativos'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Scale className="size-4" />
        Ativos
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
        onClick={() => irPara('arquivados')}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          tab === 'arquivados'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Archive className="size-4" />
        Arquivados / Concluídos
        {totalArquivados > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            tab === 'arquivados' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-muted text-muted-foreground'
          }`}>
            {totalArquivados}
          </span>
        )}
      </button>
    </div>
  )
}
