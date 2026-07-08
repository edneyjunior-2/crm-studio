'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { concluirProcesso, reativarProcesso } from './actions'

type Modo = 'concluir' | 'reativar'

interface Props {
  processoId: string
  statusAtual: string
}

export function ArquivarConcluirDialog({ processoId, statusAtual }: Props) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [modo, setModo]     = useState<Modo>('concluir')
  const [motivo, setMotivo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [pending, start]    = useTransition()

  const isInativo = statusAtual === 'concluido'

  function abrir(m: Modo) {
    setModo(m)
    setMotivo('')
    setDescricao('')
    setOpen(true)
  }

  function confirmar() {
    if (!motivo.trim()) return
    start(async () => {
      const fn = modo === 'concluir' ? concluirProcesso : reativarProcesso
      const res = await fn(processoId, motivo, descricao)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(modo === 'concluir' ? 'Processo concluído.' : 'Processo reativado.')
        setOpen(false)
        router.refresh()
      }
    })
  }

  const inputCls = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'
  const textareaCls = 'w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40'

  const config = {
    concluir: {
      label: 'Marcar como concluído',
      icon:  CheckCircle,
      color: 'text-emerald-600',
      btn:   'bg-emerald-600 hover:bg-emerald-700 text-white',
      placeholder: 'Ex: Acordo firmado, sentença favorável transitada em julgado…',
    },
    reativar: {
      label: 'Reativar processo',
      icon:  RotateCcw,
      color: 'text-primary',
      btn:   'bg-foreground hover:bg-foreground/90 text-background',
      placeholder: 'Ex: Recurso interposto, nova documentação recebida…',
    },
  }

  return (
    <>
      {isInativo ? (
        <button
          type="button"
          onClick={() => abrir('reativar')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <RotateCcw className="size-3.5" />
          Reativar
        </button>
      ) : (
        <button
          type="button"
          onClick={() => abrir('concluir')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-emerald-400/60 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
        >
          <CheckCircle className="size-3.5" />
          Concluir
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${config[modo].color}`}>
              {(() => { const Icon = config[modo].icon; return <Icon className="size-4" /> })()}
              {config[modo].label}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Motivo <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={config[modo].placeholder}
                maxLength={200}
                className={inputCls}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Descrição complementar
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes adicionais, observações, próximos passos… (opcional)"
                rows={3}
                className={textareaCls}
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={pending || !motivo.trim()}
              className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${config[modo].btn}`}
            >
              {pending ? 'Salvando…' : 'Confirmar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
