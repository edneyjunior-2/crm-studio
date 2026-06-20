'use client'

import { useState } from 'react'
import { Zap, Copy, CheckCheck, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AcceptButtonProps {
  bugId: string
  currentStatus: string
  prompt: string
  hasPrompt: boolean
}

export function AcceptButton({ bugId, currentStatus, prompt, hasPrompt }: AcceptButtonProps) {
  const [status, setStatus] = useState(currentStatus)
  const [copied, setCopied] = useState(false)
  const [triggering, setTriggering] = useState(false)

  const isResolved = status === 'resolvido' || status === 'ignorado'
  const isTriggered = status === 'em_analise'

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    toast.success('Prompt copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAccept() {
    if (!hasPrompt) {
      toast.error('Nenhum prompt gerado ainda.')
      return
    }
    setTriggering(true)
    try {
      const res = await fetch(`/api/admin/bugs/${bugId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha')
      setStatus('em_analise')
      toast.success('Workflow disparado! Acompanhe no GitHub Actions.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao disparar.')
    } finally {
      setTriggering(false)
    }
  }

  async function handleIgnore() {
    const res = await fetch(`/api/admin/bugs/${bugId}/trigger`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ignorado' }),
    })
    if (res.ok) {
      setStatus('ignorado')
      toast.success('Bug marcado como ignorado.')
    }
  }

  if (isResolved) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
        <CheckCheck className="size-4 shrink-0" />
        {status === 'resolvido' ? 'Correção aceita e disparada.' : 'Bug ignorado.'}
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {isTriggered && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2.5 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Loader2 className="size-4 animate-spin" />
          Workflow em execução — aguarde o PR no GitHub.
        </div>
      )}

      <div className="flex gap-2">
        {hasPrompt && (
          <button
            type="button"
            onClick={copyPrompt}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            {copied ? <CheckCheck className="size-4 text-green-500" /> : <Copy className="size-4" />}
            {copied ? 'Copiado!' : 'Copiar prompt'}
          </button>
        )}

        <button
          type="button"
          onClick={handleIgnore}
          disabled={triggering}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive disabled:opacity-50"
        >
          <X className="size-4" />
          Ignorar
        </button>

        <button
          type="button"
          onClick={handleAccept}
          disabled={triggering || !hasPrompt || isTriggered}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {triggering
            ? <><Loader2 className="size-4 animate-spin" /> Disparando…</>
            : <><Zap className="size-4" /> Aceitar e corrigir</>
          }
        </button>
      </div>
    </div>
  )
}
