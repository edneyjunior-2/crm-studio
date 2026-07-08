'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { atualizarStatusProcesso, deletarProcesso } from './actions'
import { ArquivarConcluirDialog } from './arquivar-concluir-dialog'
import { PROCESSO_STATUS_LABEL } from '@/lib/processos-status'

// Statuses controlados pelo select rápido (sem confirmação obrigatória)
const STATUS_RAPIDOS = [
  { value: 'em_transito', label: PROCESSO_STATUS_LABEL.em_transito },
  { value: 'suspenso',    label: PROCESSO_STATUS_LABEL.suspenso },
]

// Statuses que exigem o dialog com motivo obrigatório
const STATUS_COM_DIALOG = ['concluido']

export function ProcessoAcoes({
  processoId,
  statusAtual,
  podeExcluir,
}: {
  processoId: string
  statusAtual: string
  podeExcluir: boolean
}) {
  const router = useRouter()
  const [status, setStatus]           = useState(statusAtual)
  const [salvando, startSalvar]       = useTransition()
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo]     = useState(false)

  const isComDialog = STATUS_COM_DIALOG.includes(status)

  function handleStatus(novo: string) {
    const anterior = status
    setStatus(novo)
    startSalvar(async () => {
      const res = await atualizarStatusProcesso(processoId, novo)
      if (res.error) {
        setStatus(anterior)
        toast.error(res.error)
      } else {
        toast.success('Status atualizado.')
        router.refresh()
      }
    })
  }

  async function handleDelete() {
    setExcluindo(true)
    const res = await deletarProcesso(processoId)
    if (res?.error) {
      toast.error(res.error)
      setExcluindo(false)
      setConfirmando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Select rápido: só para em trânsito/suspenso */}
      {!isComDialog && (
        <select
          value={status}
          onChange={(e) => handleStatus(e.target.value)}
          disabled={salvando}
          aria-label="Status do processo"
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium outline-none focus:border-foreground/40 disabled:opacity-60"
        >
          {STATUS_RAPIDOS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      )}

      {/* Badge quando está concluído */}
      {isComDialog && (
        <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          {PROCESSO_STATUS_LABEL.concluido}
        </span>
      )}

      {salvando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

      {/* Botão Concluir / Reativar */}
      <ArquivarConcluirDialog processoId={processoId} statusAtual={status} />

      {/* Excluir (admin only) */}
      {podeExcluir && (
        confirmando ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Excluir?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={excluindo}
              className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-60"
            >
              {excluindo ? <Loader2 className="size-3.5 animate-spin" /> : 'Sim'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={excluindo}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              Não
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            title="Excluir processo"
            aria-label="Excluir processo"
            className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )
      )}
    </div>
  )
}
