'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { atualizarStatusBug } from './actions'

const STATUS_OPTIONS = [
  { value: 'aberto',     label: 'Aberto' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'resolvido',  label: 'Resolvido' },
  { value: 'ignorado',   label: 'Ignorado' },
]

export function BugDetailPanel({ bugId, currentStatus }: { bugId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  async function updateStatus(next: string) {
    setSaving(true)
    const result = await atualizarStatusBug(bugId, next)
    if (result.error) {
      toast.error(result.error)
    } else {
      setStatus(next)
      toast.success('Status atualizado.')
    }
    setSaving(false)
  }

  return (
    // O card inteiro é um <a> pro relatório completo (page.tsx). A navegação
    // nativa do <a> não é bloqueada por stopPropagation sozinho — só
    // preventDefault cancela; por isso os dois juntos aqui.
    <div
      className="shrink-0"
      onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <select
        value={status}
        disabled={saving}
        onChange={(e) => updateStatus(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
