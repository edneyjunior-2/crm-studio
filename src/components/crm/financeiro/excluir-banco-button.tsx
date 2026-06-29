'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteBanco } from '@/app/(crm)/financeiro/bancos/actions'

export function ExcluirBancoButton({
  bancoId,
  bancoNome,
  qtdMovimentacoes,
}: {
  bancoId: string
  bancoNome: string
  qtdMovimentacoes: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteBanco(bancoId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Conta "${bancoNome}" excluída.`)
      router.push('/financeiro/bancos')
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-4" />
        Excluir
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir conta bancária?</AlertDialogTitle>
          <AlertDialogDescription>
            A conta <strong>{bancoNome}</strong> será excluída permanentemente.
            {qtdMovimentacoes > 0
              ? ` Há ${qtdMovimentacoes} movimentação${qtdMovimentacoes !== 1 ? 'ões' : ''} vinculada${qtdMovimentacoes !== 1 ? 's' : ''} a esta conta — a exclusão pode ser bloqueada pelo banco de dados. Esta ação não pode ser desfeita.`
              : ' Esta ação não pode ser desfeita.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleDelete}>
            {isPending ? 'Excluindo...' : 'Excluir conta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
