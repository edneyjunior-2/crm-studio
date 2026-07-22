'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { atualizarStatusBug } from './actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const STATUS_OPTIONS = [
  { value: 'aberto',     label: 'Aberto' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'resolvido',  label: 'Resolvido' },
  { value: 'ignorado',   label: 'Ignorado' },
]

export function BugDetailPanel({ bugId, currentStatus }: { bugId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)
  const [resolverOpen, setResolverOpen] = useState(false)
  const [notas, setNotas] = useState('')

  async function updateStatus(next: string, notasResolucao?: string) {
    setSaving(true)
    const result = await atualizarStatusBug(bugId, next, notasResolucao)
    if (result.error) {
      toast.error(result.error)
    } else {
      setStatus(next)
      toast.success('Status atualizado.')
    }
    setSaving(false)
  }

  function handleSelectChange(next: string) {
    // Resolvido dispara e-mail pro autor do chamado — abre o dialog pra dar
    // a chance de explicar o que foi feito (opcional) antes de mandar.
    if (next === 'resolvido' && status !== 'resolvido') {
      setNotas('')
      setResolverOpen(true)
      return
    }
    updateStatus(next)
  }

  async function confirmarResolucao() {
    await updateStatus('resolvido', notas.trim() || undefined)
    setResolverOpen(false)
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
        onChange={(e) => handleSelectChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <Dialog open={resolverOpen} onOpenChange={(v) => { if (!saving) setResolverOpen(v) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como resolvido</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notas-resolucao">O que foi feito (opcional)</Label>
            <Textarea
              id="notas-resolucao"
              placeholder="Deixe em branco pra enviar só o aviso de que foi resolvido"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              A pessoa que reportou recebe um e-mail avisando que o problema foi resolvido
              {notas.trim() ? ', com essa explicação.' : '.'}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" disabled={saving} />}>
              Cancelar
            </DialogClose>
            <Button onClick={confirmarResolucao} disabled={saving}>
              {saving ? 'Salvando...' : 'Confirmar e enviar e-mail'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
