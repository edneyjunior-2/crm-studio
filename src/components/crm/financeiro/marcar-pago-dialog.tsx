'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { marcarPago } from '@/app/(crm)/financeiro/actions'
import type { ContaPagar, Banco } from '@/types'
import { formatMoeda } from '@/lib/moedas'

export type BancoComSaldo = Banco & { saldo: number }

interface MarcarPagoDialogProps {
  conta: ContaPagar
  bancos: BancoComSaldo[]
  trigger?: React.ReactNode
}

export function MarcarPagoDialog({ conta, bancos, trigger }: MarcarPagoDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const today = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()
  const [dataPagamento, setDataPagamento] = useState(today)
  const [bancoId, setBancoId] = useState<string | null>(bancos.length === 1 ? bancos[0].id : null)
  const [multa, setMulta] = useState<string>('0')
  const [juros, setJuros] = useState<string>('0')

  const multaNum = parseFloat(multa) || 0
  const jurosNum = parseFloat(juros) || 0
  const totalReal = Number(conta.valor) + multaNum + jurosNum
  const temAcrescimos = multaNum + jurosNum > 0

  const bancoCurrent = bancos.find((b) => b.id === bancoId) ?? null
  const saldoApos = bancoCurrent ? bancoCurrent.saldo - totalReal : null

  function handleConfirm() {
    startTransition(async () => {
      const result = await marcarPago(
        conta.id,
        dataPagamento,
        bancoId ?? undefined,
        multaNum || undefined,
        jurosNum || undefined
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Pagamento registrado.')
      setOpen(false)
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger ?? (
          <Button variant="ghost" size="icon-sm" className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600">
            <CheckCircle className="size-3.5" />
            <span className="sr-only">Marcar pago</span>
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Valor original:{' '}
              <strong className="text-foreground font-mono">{formatMoeda(conta.valor, conta.moeda)}</strong>
              {conta.fornecedor ? ` · ${conta.fornecedor}` : ''}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="multa">Multa (R$)</Label>
                <Input
                  id="multa"
                  type="number"
                  min={0}
                  step={0.01}
                  value={multa}
                  onChange={(e) => setMulta(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="juros">Juros (R$)</Label>
                <Input
                  id="juros"
                  type="number"
                  min={0}
                  step={0.01}
                  value={juros}
                  onChange={(e) => setJuros(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            {temAcrescimos && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800">Total real pago</span>
                <span className="font-mono font-semibold text-amber-800">
                  {formatMoeda(totalReal, conta.moeda)}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Conta bancária de débito</Label>
              <Select value={bancoId ?? ''} onValueChange={(v) => setBancoId(v || null)}>
                <SelectTrigger className="w-full">
                  {bancoCurrent ? (
                    <span className="flex flex-1 truncate text-left">
                      {bancoCurrent.nome}
                      {bancoCurrent.instituicao ? ` — ${bancoCurrent.instituicao}` : ''}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Selecione a conta...</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {bancos.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                      {b.instituicao ? ` — ${b.instituicao}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bancoCurrent && (
              <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Saldo atual</span>
                  <span className={`font-mono font-medium ${bancoCurrent.saldo >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                    {formatMoeda(bancoCurrent.saldo)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Após o pagamento</span>
                  <span className={`font-mono font-medium ${(saldoApos ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatMoeda(saldoApos ?? 0)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data_pagamento">Data de Pagamento</Label>
              <Input
                id="data_pagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button onClick={handleConfirm} disabled={isPending || !dataPagamento}>
              {isPending ? 'Salvando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
