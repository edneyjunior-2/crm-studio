'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { excluirConta } from '@/app/(crm)/configuracoes/actions'

interface Props {
  /** Nome da empresa — usado na confirmação forte (padrão GitHub). */
  empresaNome: string
  /** true se a conta está EM DIA e pode ser excluída. */
  podeExcluir: boolean
  /** Mensagem de bloqueio quando há pendência (null se em dia). */
  motivo: string | null
}

export function ExcluirConta({ empresaNome, podeExcluir, motivo }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')
  const [isPending, startTransition] = useTransition()

  const nomeConfere = confirmacao.trim() === empresaNome.trim()

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return
    setOpen(nextOpen)
    if (!nextOpen) setConfirmacao('')
  }

  function handleExcluir() {
    if (!nomeConfere || !podeExcluir) return

    startTransition(async () => {
      const result = await excluirConta(confirmacao)
      // Em caso de sucesso, a server action faz redirect (signOut + /login),
      // então só chegamos aqui se houve erro.
      if (result?.error) {
        toast.error(result.error)
        return
      }
      // Fallback defensivo: se por algum motivo não houver redirect.
      router.push('/login?conta=excluida')
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium text-destructive">Zona de perigo</h3>
        <p className="text-sm text-muted-foreground">
          Ações irreversíveis. Tenha certeza antes de prosseguir.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Excluir conta</span>
          <p className="text-sm text-muted-foreground">
            Cancela a assinatura e encerra o acesso de toda a empresa ao CRM Studio.
            Esta ação não pode ser desfeita.
          </p>
        </div>

        {podeExcluir ? (
          <div className="inline-flex w-fit items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Pagamentos em dia
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-foreground">
                {motivo ?? 'Regularize o pagamento pendente antes de excluir a conta.'}
              </span>
              <a
                href="/assinatura"
                className="w-fit font-medium text-primary underline-offset-4 hover:underline"
              >
                Regularizar pagamento
              </a>
            </div>
          </div>
        )}

        <Button
          variant="destructive"
          className="w-fit"
          disabled={!podeExcluir}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" />
          Excluir conta
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. A assinatura será cancelada e todos os
              usuários perderão o acesso ao CRM Studio.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmacao-nome">
              Para confirmar, digite{' '}
              <span className="font-semibold text-foreground">{empresaNome}</span>:
            </Label>
            <Input
              id="confirmacao-nome"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={empresaNome}
              autoComplete="off"
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              type="button"
              disabled={!nomeConfere || !podeExcluir || isPending}
              onClick={handleExcluir}
            >
              {isPending ? 'Excluindo...' : 'Excluir conta permanentemente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
