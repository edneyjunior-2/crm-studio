'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { marcarComissaoPaga, cancelarComissao } from '@/app/(crm)/financeiro/comissoes/actions'
import type { ComissaoComRelacoes } from '@/types'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('pt-BR')
}

const statusConfig = {
  previsto: { label: 'Previsto', variant: 'secondary' as const },
  pago: { label: 'Pago', variant: 'default' as const },
  cancelado: { label: 'Cancelado', variant: 'outline' as const },
}

interface ComissoesAdminTableProps {
  comissoes: ComissaoComRelacoes[]
}

export function ComissoesAdminTable({ comissoes }: ComissoesAdminTableProps) {
  const [pagarOpen, setPagarOpen] = useState<string | null>(null)
  const [dataPagamento, setDataPagamento] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleMarcarPago(id: string) {
    if (!dataPagamento) return
    startTransition(async () => {
      const result = await marcarComissaoPaga(id, dataPagamento)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Comissão marcada como paga.')
      setPagarOpen(null)
      setDataPagamento('')
    })
  }

  function handleCancelar(id: string) {
    startTransition(async () => {
      const result = await cancelarComissao(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Comissão cancelada.')
    })
  }

  if (comissoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
        <Users className="mb-2 size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhuma comissão lançada ainda.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Use o botão acima para lançar uma comissão para um comercial.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Comercial</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Descrição</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Negócio</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Valor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Previsão</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pago em</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {comissoes.map((c) => {
              const cfg = statusConfig[c.status]
              return (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {c.parceiros_comissao?.nome ? (
                      <span className="flex items-center gap-1.5">
                        {c.parceiros_comissao.nome}
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                          Parceiro
                        </span>
                      </span>
                    ) : (
                      c.profiles?.full_name ?? '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">
                    {c.descricao}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.negocios?.titulo ?? <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                    {BRL(Number(c.valor))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(c.data_previsao)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {c.data_pagamento ? formatDate(c.data_pagamento) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {c.status === 'previsto' && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="Marcar como pago"
                          onClick={() => { setPagarOpen(c.id); setDataPagamento('') }}
                        >
                          <CheckCircle2 className="size-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Cancelar comissão"
                              />
                            }
                          >
                            <XCircle className="size-4" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancelar comissão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja cancelar esta comissão de{' '}
                                <strong>{c.profiles?.full_name}</strong>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => handleCancelar(c.id)}
                              >
                                Cancelar comissão
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog marcar como pago */}
      <Dialog open={!!pagarOpen} onOpenChange={(v) => { if (!v) setPagarOpen(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="data-pag" className="text-sm font-medium">
              Data do pagamento <span className="text-destructive">*</span>
            </label>
            <Input
              id="data-pag"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button
              disabled={isPending || !dataPagamento}
              onClick={() => pagarOpen && handleMarcarPago(pagarOpen)}
            >
              {isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
