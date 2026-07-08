'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { reabrirNegocio, requalificarNegocio, deleteNegocio } from '@/app/(crm)/pipeline/actions'

interface NegocioCardActionsProps {
  negocioId: string
  negocioTitulo: string
  desqualificado?: boolean
}

export function NegocioCardActions({ negocioId, negocioTitulo, desqualificado = false }: NegocioCardActionsProps) {
  const router = useRouter()
  const [isPendingReabrir, startReabrir] = useTransition()
  const [isPendingExcluir, startExcluir] = useTransition()
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  function handleReabrir() {
    startReabrir(async () => {
      const result = desqualificado
        ? await requalificarNegocio(negocioId)
        : await reabrirNegocio(negocioId)
      if (result?.error) {
        toast.error(
          desqualificado ? 'Erro ao requalificar negócio' : 'Erro ao reabrir negócio',
          { description: result.error }
        )
      } else {
        toast.success(desqualificado ? 'Negócio requalificado' : 'Negócio reaberto', {
          description: desqualificado
            ? `"${negocioTitulo}" voltou para o pipeline.`
            : `"${negocioTitulo}" voltou para Negociação.`,
        })
        router.refresh()
      }
    })
  }

  function handleExcluir() {
    if (!confirmandoExclusao) {
      setConfirmandoExclusao(true)
      // Reseta confirmação após 4 segundos se o usuário não confirmar
      setTimeout(() => setConfirmandoExclusao(false), 4000)
      return
    }

    setConfirmandoExclusao(false)
    startExcluir(async () => {
      const result = await deleteNegocio(negocioId)
      if (result?.error) {
        toast.error('Erro ao excluir negócio', { description: result.error })
      } else {
        toast.success('Negócio excluído', { description: `"${negocioTitulo}" foi removido.` })
        router.refresh()
      }
    })
  }

  const isPending = isPendingReabrir || isPendingExcluir

  return (
    <div className="flex shrink-0 items-center gap-1 mt-1 sm:mt-0">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={handleReabrir}
        disabled={isPending}
        title={desqualificado ? 'Requalificar negócio (volta para o pipeline)' : 'Reabrir negócio (volta para Negociação)'}
      >
        <RotateCcw className="size-3.5" />
        {desqualificado ? 'Requalificar' : 'Reabrir'}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className={
          confirmandoExclusao
            ? 'h-7 gap-1.5 px-2 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive'
            : 'h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive'
        }
        onClick={handleExcluir}
        disabled={isPending}
        title={confirmandoExclusao ? 'Clique novamente para confirmar a exclusão' : 'Excluir negócio'}
      >
        <Trash2 className="size-3.5" />
        {confirmandoExclusao ? 'Confirmar?' : 'Excluir'}
      </Button>
    </div>
  )
}
