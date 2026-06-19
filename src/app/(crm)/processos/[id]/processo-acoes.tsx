'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { atualizarStatusProcesso, deletarProcesso } from './actions'

const STATUS = [
  { value: 'ativo',     label: 'Ativo' },
  { value: 'encerrado', label: 'Encerrado' },
  { value: 'suspenso',  label: 'Suspenso' },
  { value: 'arquivado', label: 'Arquivado' },
]

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
    // Em caso de sucesso a action redireciona para /processos; só chega aqui em erro.
    if (res?.error) {
      toast.error(res.error)
      setExcluindo(false)
      setConfirmando(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => handleStatus(e.target.value)}
        disabled={salvando}
        aria-label="Status do processo"
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium outline-none focus:border-foreground/40 disabled:opacity-60"
      >
        {STATUS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {salvando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

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
