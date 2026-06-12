'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ParceiroPendente {
  id: string
  nome: string
  diasAtraso: number
}

interface ContratoPrazoAlertProps {
  parceiros: ParceiroPendente[]
}

export function ContratoPrazoAlert({ parceiros }: ContratoPrazoAlertProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (parceiros.length === 0) return
    const key = 'contrato_alert_parceiros_' + parceiros.map(p => p.id).sort().join(',')
    if (sessionStorage.getItem(key)) return
    setOpen(true)
    sessionStorage.setItem(key, '1')
  }, [parceiros])

  if (parceiros.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="size-5" />
            Contratos pendentes
          </DialogTitle>
          <DialogDescription>
            {parceiros.length === 1
              ? 'O parceiro abaixo ainda não tem contrato enviado e o prazo de 5 dias foi ultrapassado.'
              : `${parceiros.length} parceiros ainda não têm contrato enviado e o prazo de 5 dias foi ultrapassado.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {parceiros.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/30"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{p.nome}</span>
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {p.diasAtraso === 1 ? '1 dia em atraso' : `${p.diasAtraso} dias em atraso`}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => {
                  setOpen(false)
                  router.push(`/parceiros/${p.id}`)
                }}
              >
                Enviar agora
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
