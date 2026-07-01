'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
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
import { createContaReceber, updateContaReceber } from '@/app/(crm)/financeiro/actions'
import type { ContaReceber, Cliente, Negocio, Moeda } from '@/types'
import { MOEDAS } from '@/lib/moedas'

interface ContaReceberFormProps {
  conta?: ContaReceber
  clientes: Pick<Cliente, 'id' | 'razao_social'>[]
  negocios: Pick<Negocio, 'id' | 'titulo'>[]
  trigger: React.ReactNode
}

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'atrasado', label: 'Atrasado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export function ContaReceberForm({ conta, clientes, negocios, trigger }: ContaReceberFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [descricao, setDescricao] = useState(conta?.descricao ?? '')
  const [valor, setValor] = useState<string>(conta?.valor != null ? String(conta.valor) : '')
  const [dataVencimento, setDataVencimento] = useState(conta?.data_vencimento ?? '')
  const [clienteId, setClienteId] = useState<string | null>(conta?.cliente_id ?? null)
  const [negocioId, setNegocioId] = useState<string | null>(conta?.negocio_id ?? null)
  const [status, setStatus] = useState<string>(conta?.status ?? 'pendente')
  const [moeda, setMoeda] = useState<Moeda>(conta?.moeda ?? 'BRL')

  // Resincroniza todos os campos quando a conta muda entre aberturas do dialog
  useEffect(() => {
    if (!open) return
    setDescricao(conta?.descricao ?? '')
    setValor(conta?.valor != null ? String(conta.valor) : '')
    setDataVencimento(conta?.data_vencimento ?? '')
    setClienteId(conta?.cliente_id ?? null)
    setNegocioId(conta?.negocio_id ?? null)
    setStatus(conta?.status ?? 'pendente')
    setMoeda(conta?.moeda ?? 'BRL')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conta?.id])

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData()
    formData.set('descricao', descricao)
    formData.set('valor', valor)
    formData.set('data_vencimento', dataVencimento)
    formData.set('cliente_id', clienteId ?? '')
    formData.set('negocio_id', negocioId ?? '')
    formData.set('status', status)
    formData.set('moeda', moeda)

    startTransition(async () => {
      const result = conta
        ? await updateContaReceber(conta.id, formData)
        : await createContaReceber(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        conta ? 'Conta a receber atualizada.' : 'Conta a receber criada.'
      )
      setOpen(false)
      if (!conta) {
        setDescricao('')
        setValor('')
        setDataVencimento('')
        setClienteId(null)
        setNegocioId(null)
        setStatus('pendente')
        setMoeda('BRL')
      }
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {conta ? 'Editar conta a receber' : 'Nova conta a receber'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="descricao">
                Descrição <span className="text-destructive">*</span>
              </Label>
              <Input
                id="descricao"
                name="descricao"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Comissão — Venda ERP Q1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                Cliente <span className="text-destructive">*</span>
              </Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="w-full">
                  {clienteId ? (
                    <span>{clientes.find((c) => c.id === clienteId)?.razao_social ?? '—'}</span>
                  ) : (
                    <span className="text-muted-foreground">Selecione um cliente...</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Negócio (Opcional)</Label>
              <Select value={negocioId ?? ''} onValueChange={(v) => setNegocioId(v || null)}>
                <SelectTrigger className="w-full">
                  {negocioId ? (
                    <span>{negocios.find((n) => n.id === negocioId)?.titulo ?? '—'}</span>
                  ) : (
                    <span className="text-muted-foreground">Vincular a um negócio...</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {negocios.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Moeda</Label>
              <Select value={moeda} onValueChange={(v) => { if (v) setMoeda(v as Moeda) }}>
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 text-left line-clamp-1 text-sm">
                    {MOEDAS.find((m) => m.value === moeda)
                      ? `${MOEDAS.find((m) => m.value === moeda)!.flag} ${moeda} — ${MOEDAS.find((m) => m.value === moeda)!.label}`
                      : moeda}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {MOEDAS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.flag} {m.value} — {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="valor">
                  Valor <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="valor"
                  name="valor"
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="data_vencimento">
                  Vencimento <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="data_vencimento"
                  name="data_vencimento"
                  type="date"
                  required
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => { if (v) setStatus(v) }}>
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 text-left line-clamp-1 text-sm">
                    {STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending || !clienteId}>
                {isPending
                  ? 'Salvando...'
                  : conta
                    ? 'Salvar alterações'
                    : 'Criar conta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
