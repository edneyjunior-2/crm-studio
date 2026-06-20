'use client'

import { useState } from 'react'
import { Calendar, Loader2, CheckCircle2 } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { adicionarAudienciaAoCalendario } from './actions'

interface Props {
  descricao:      string
  /** Data do movimento (YYYY-MM-DD) — usada apenas como sugestão inicial. */
  dataSugerida:   string
  processoNumero: string
}

export function AudienciaButton({ descricao, dataSugerida, processoNumero }: Props) {
  const [aberto,  setAberto]  = useState(false)
  const [data,    setData]    = useState(dataSugerida)
  const [hora,    setHora]    = useState('09:00')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro,    setErro]    = useState<string | null>(null)

  async function handleConfirmar() {
    if (!data) { setErro('Informe a data da audiência.'); return }
    setLoading(true)
    setErro(null)
    // Monta um datetime local (BRT, UTC-3) e converte para ISO.
    const dataHoraISO = new Date(`${data}T${hora || '09:00'}:00-03:00`).toISOString()
    const res = await adicionarAudienciaAoCalendario(descricao, dataHoraISO, processoNumero)
    setLoading(false)
    if (res.error) {
      setErro(res.error)
    } else {
      setSucesso(true)
    }
  }

  if (sucesso) {
    return (
      <StatusBadge variant="recebido" className="gap-1.5 rounded-lg px-3 py-1.5">
        <CheckCircle2 className="size-3.5" />
        Adicionado
      </StatusBadge>
    )
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-300"
      >
        <Calendar className="size-3.5" />
        Adicionar ao calendário
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/40"
        />
        <input
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/40"
        />
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-60 dark:border-amber-700 dark:bg-transparent dark:text-amber-300"
        >
          {loading
            ? <Loader2 className="size-3.5 animate-spin" />
            : <CheckCircle2 className="size-3.5" />}
          Confirmar
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Confirme a data e a hora reais da audiência.
      </p>
      {erro && <p className="text-[11px] text-destructive">{erro}</p>}
    </div>
  )
}
