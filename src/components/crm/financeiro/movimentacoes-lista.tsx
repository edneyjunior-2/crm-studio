'use client'

import { useTransition } from 'react'
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react'
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
import { deleteMovimentacao } from '@/app/(crm)/financeiro/bancos/actions'
import type { Movimentacao } from '@/types'

interface MovimentacoesListaProps {
  movimentacoes: Movimentacao[]
  bancoId: string
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function DeleteMovButton({ id, bancoId }: { id: string; bancoId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMovimentacao(id, bancoId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Movimentação excluída.')
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-3.5" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. A movimentação será removida permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function MovimentacoesLista({ movimentacoes, bancoId }: MovimentacoesListaProps) {
  if (movimentacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">Nenhuma movimentação registrada</p>
        <p className="text-xs text-muted-foreground/70">
          Registre a primeira movimentação usando o botão acima.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {movimentacoes.map((mov) => (
        <div key={mov.id} className="flex items-center gap-3 px-5 py-3">
          <div
            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
              mov.tipo === 'entrada' ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}
          >
            {mov.tipo === 'entrada' ? (
              <TrendingUp className="size-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="size-3.5 text-red-600" />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{mov.descricao}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(mov.data)}</span>
              {mov.destino_origem && (
                <>
                  <span>·</span>
                  <span className="truncate">{mov.destino_origem}</span>
                </>
              )}
              {mov.categoria && (
                <>
                  <span>·</span>
                  <span>{mov.categoria}</span>
                </>
              )}
            </div>
          </div>

          <p
            className={`shrink-0 font-mono text-sm font-semibold ${
              mov.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {mov.tipo === 'entrada' ? '+' : '-'} {BRL(Number(mov.valor))}
          </p>

          <DeleteMovButton id={mov.id} bancoId={bancoId} />
        </div>
      ))}
    </div>
  )
}
