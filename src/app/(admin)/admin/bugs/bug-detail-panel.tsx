'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

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
    const supabase = createClient()
    const { error } = await supabase
      .from('bug_reports')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', bugId)
    if (error) {
      toast.error('Falha ao atualizar.')
    } else {
      setStatus(next)
      toast.success('Status atualizado.')
    }
    setSaving(false)
  }

  return (
    <div className="shrink-0">
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
