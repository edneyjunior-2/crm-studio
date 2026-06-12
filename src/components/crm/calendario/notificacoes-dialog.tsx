'use client'

import { useState, useTransition } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { marcarNotificacoesVistas } from '@/app/(crm)/calendario/actions'

export interface CalendarioNotificacao {
  id: string
  event_id: string
  event_title: string
  changed_by_nome: string
  campo: 'titulo' | 'horario' | 'descricao' | 'participantes'
  valor_anterior: string | null
  valor_novo: string | null
  created_at: string
}

interface Props {
  notificacoes: CalendarioNotificacao[]
}

function formatarHorarioIso(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function mensagemNotificacao(n: CalendarioNotificacao): string {
  const nome = n.changed_by_nome

  if (n.campo === 'titulo') {
    return `${nome} alterou o título de "${n.valor_anterior}" para "${n.valor_novo}"`
  }

  if (n.campo === 'horario' && n.valor_anterior && n.valor_novo) {
    const [iniAnt, fimAnt] = n.valor_anterior.split('|')
    const [iniNov, fimNov] = n.valor_novo.split('|')
    const fmtIntervalo = (ini: string, fim: string) =>
      `${formatarHorarioIso(ini)}–${formatarHorarioIso(fim)}`
    return `${nome} alterou o horário de "${n.event_title}" de ${fmtIntervalo(iniAnt, fimAnt)} para ${fmtIntervalo(iniNov, fimNov)}`
  }

  if (n.campo === 'descricao') {
    return `${nome} alterou a descrição de "${n.event_title}"`
  }

  if (n.campo === 'participantes') {
    return `${nome} alterou os participantes de "${n.event_title}"`
  }

  return `${nome} editou "${n.event_title}"`
}

export function NotificacoesDialog({ notificacoes }: Props) {
  const [open, setOpen] = useState(notificacoes.length > 0)
  const [isPending, startTransition] = useTransition()

  if (notificacoes.length === 0) return null

  // Agrupar por event_id para clareza visual
  const grupos = notificacoes.reduce<Record<string, CalendarioNotificacao[]>>((acc, n) => {
    if (!acc[n.event_id]) acc[n.event_id] = []
    acc[n.event_id].push(n)
    return acc
  }, {})

  function handleEntendido() {
    startTransition(async () => {
      const result = await marcarNotificacoesVistas()
      if (result.error) {
        toast.error('Erro ao marcar notificações: ' + result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            Alterações nos seus eventos
          </DialogTitle>
          <DialogDescription>
            Outros membros fizeram alterações nos eventos que você criou.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {Object.entries(grupos).map(([eventId, itens]) => (
            <div key={eventId} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {itens[0].event_title}
              </p>
              <ul className="flex flex-col gap-1">
                {itens.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground"
                  >
                    {mensagemNotificacao(n)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Fechar
          </Button>
          <Button onClick={handleEntendido} disabled={isPending}>
            {isPending ? 'Aguarde...' : 'Entendido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
