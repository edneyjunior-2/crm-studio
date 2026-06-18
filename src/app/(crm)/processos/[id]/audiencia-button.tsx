'use client'

import { useState } from 'react'
import { Calendar, Loader2, CheckCircle2 } from 'lucide-react'
import { adicionarAudienciaAoCalendario } from './actions'

interface Props {
  descricao:      string
  dataHora:       string
  processoNumero: string
}

export function AudienciaButton({ descricao, dataHora, processoNumero }: Props) {
  const [loading, setLoading]   = useState(false)
  const [sucesso, setSucesso]   = useState(false)
  const [erro,    setErro]      = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setErro(null)
    const res = await adicionarAudienciaAoCalendario(descricao, dataHora, processoNumero)
    setLoading(false)
    if (res.error) {
      setErro(res.error)
    } else {
      setSucesso(true)
    }
  }

  if (sucesso) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
        <CheckCircle2 className="size-3.5" />
        Adicionado
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-60 dark:border-amber-700 dark:bg-transparent dark:text-amber-300"
      >
        {loading
          ? <Loader2 className="size-3.5 animate-spin" />
          : <Calendar className="size-3.5" />}
        Adicionar ao calendário
      </button>
      {erro && <p className="text-[11px] text-destructive">{erro}</p>}
    </div>
  )
}
