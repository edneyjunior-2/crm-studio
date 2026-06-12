'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { concluirFollowup } from '@/app/(crm)/pipeline/followup-actions'
import type { Followup } from '@/types'

const TIPO_LABEL: Record<string, string> = {
  d3: 'Follow-up D+3',
  d7: 'Alerta Final D+7',
}

function diasAtraso(dataAgendada: string): number {
  const hoje = new Date()
  const agendada = new Date(dataAgendada + 'T12:00:00')
  return Math.floor((hoje.getTime() - agendada.getTime()) / (1000 * 60 * 60 * 24))
}

export function FollowupsWidget({ followups: initial }: { followups: Followup[] }) {
  const [followups, setFollowups] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function handleConcluir(id: string) {
    startTransition(async () => {
      const result = await concluirFollowup(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setFollowups((prev) => prev.filter((f) => f.id !== id))
      toast.success('Follow-up concluído.')
    })
  }

  if (followups.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Mail className="size-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-foreground">Follow-ups de hoje</h3>
        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
          {followups.length}
        </span>
      </div>

      <div className="divide-y divide-border">
        {followups.map((f) => {
          const atraso = diasAtraso(f.data_agendada)
          const isAtrasado = atraso > 0

          return (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${isAtrasado ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                {isAtrasado
                  ? <AlertTriangle className="size-3.5 text-amber-600" />
                  : <Clock className="size-3.5 text-blue-600" />
                }
              </div>

              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {f.negocios?.titulo ?? 'Negócio'}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{f.negocios?.clientes?.razao_social ?? '—'}</span>
                  <span>·</span>
                  <span className={isAtrasado ? 'text-amber-600 font-medium' : ''}>
                    {TIPO_LABEL[f.tipo] ?? f.tipo}
                    {isAtrasado && ` · ${atraso}d de atraso`}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/pipeline"
                  className="text-xs text-primary hover:underline"
                >
                  Ver
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  onClick={() => handleConcluir(f.id)}
                  className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                  title="Marcar como concluído"
                >
                  <CheckCircle2 className="size-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
