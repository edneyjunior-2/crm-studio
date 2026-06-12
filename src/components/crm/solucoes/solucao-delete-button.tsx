'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { deleteSolucao } from '@/app/(crm)/solucoes/actions'

interface SolucaoDeleteButtonProps {
  id: string
  nome: string
}

export function SolucaoDeleteButton({ id, nome }: SolucaoDeleteButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSolucao(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`"${nome}" removida com sucesso.`)
      router.push('/solucoes')
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" disabled={isPending} />
        }
      >
        <Trash2 className="size-4" />
        {isPending ? 'Excluindo...' : 'Excluir'}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir solução</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{nome}</strong>? Esta ação
            não pode ser desfeita e a solução será removida de todos os negócios
            vinculados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
