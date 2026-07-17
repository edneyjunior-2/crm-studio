'use client'

/**
 * Popup "Você tem N reunião(ões) para confirmar" — agendamento real da Leila
 * (spec .claude/specs/sdr-agendamento-real.md, AC6/AC7/AC8). Reaproveita
 * EXATAMENTE a técnica de polling do badge de não lidas (useState inicial
 * vindo do server + useEffect/setInterval — ver src/components/crm/sidebar.tsx).
 * Montado globalmente em (crm)/layout.tsx, gateado só por "o usuário tem
 * reuniões pendentes atribuídas a ele" (nunca por módulo).
 */

import { useEffect, useState, useTransition } from 'react'
import { CalendarClock, Check, X, Video, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatarSlotPtBr } from '@/lib/sdr-agenda'
import {
  listarReunioesPendentes,
  confirmarReuniao,
  recusarReuniao,
  type ReuniaoPendente,
} from '@/app/(crm)/reunioes-sdr-actions'

/** Intervalo do polling — mesma faixa (15-30s) do badge de não lidas. */
const POLL_REUNIOES_MS = 25_000

export function ReuniaoConfirmacaoPopup({ reunioesIniciais }: { reunioesIniciais: ReuniaoPendente[] }) {
  const [reunioes, setReunioes] = useState<ReuniaoPendente[]>(reunioesIniciais)
  const [pendenteId, setPendenteId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Falha num poll individual mantém a última lista conhecida — sem
  // toast/erro, é um indicador passivo (mesmo padrão do badge de não lidas).
  useEffect(() => {
    let cancelado = false
    const id = setInterval(() => {
      listarReunioesPendentes()
        .then((lista) => {
          if (!cancelado) setReunioes(lista)
        })
        .catch(() => {
          // silencioso de propósito
        })
    }, POLL_REUNIOES_MS)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [])

  if (reunioes.length === 0) return null

  function agir(id: string, acao: 'confirmar' | 'recusar') {
    setPendenteId(id)
    startTransition(async () => {
      const resultado = acao === 'confirmar' ? await confirmarReuniao(id) : await recusarReuniao(id)
      setPendenteId(null)

      if (resultado.error) {
        if (resultado.jaResolvida) toast.info(resultado.error)
        else toast.error(resultado.error)
        // Não resolvida por mim (ex.: já respondida por outra sócia, ou
        // permissão negada) — deixa o próximo poll reconciliar a lista.
        return
      }

      if (resultado.avisoEnvioFalhou) {
        toast.warning(
          acao === 'confirmar'
            ? 'Reunião confirmada, mas não consegui avisar o lead pelo WhatsApp agora.'
            : 'Reunião recusada, mas não consegui avisar o lead pelo WhatsApp agora.',
        )
      } else {
        toast.success(acao === 'confirmar' ? 'Reunião confirmada — lead avisado.' : 'Reunião recusada — lead avisado.')
      }
      // Remove otimisticamente da lista local; o próximo poll reconcilia.
      setReunioes((atual) => atual.filter((r) => r.id !== id))
    })
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-background shadow-xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <CalendarClock className="size-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          Você tem {reunioes.length} reunião{reunioes.length !== 1 ? 'ões' : ''} para confirmar
        </span>
      </div>

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto p-3">
        {reunioes.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{r.lead_nome}</p>
                <p className="text-xs text-muted-foreground">{formatarSlotPtBr(r.data_inicio)}</p>
              </div>
              <Badge variant={r.tipo === 'video' ? 'default' : 'secondary'} className="shrink-0 gap-1">
                {r.tipo === 'video' ? <Video className="size-3" /> : <MapPin className="size-3" />}
                {r.tipo === 'video' ? 'Vídeo' : 'Presencial'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1"
                disabled={pendenteId === r.id}
                onClick={() => agir(r.id, 'confirmar')}
              >
                <Check className="size-3.5" />
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1"
                disabled={pendenteId === r.id}
                onClick={() => agir(r.id, 'recusar')}
              >
                <X className="size-3.5" />
                Recusar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
