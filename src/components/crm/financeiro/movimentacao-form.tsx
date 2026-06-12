'use client'

import { useState, useTransition } from 'react'
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
  SelectValue,
} from '@/components/ui/select'
import { createMovimentacao } from '@/app/(crm)/financeiro/bancos/actions'
import type { Moeda } from '@/types'
import { MOEDAS } from '@/lib/moedas'

interface MovimentacaoFormProps {
  bancoId: string
  trigger: React.ReactNode
}

const CATEGORIAS = [
  'Receita de vendas',
  'Comissão',
  'Serviços',
  'Fornecedores',
  'Salários',
  'Aluguel',
  'Marketing',
  'Impostos',
  'Transferência',
  'Outros',
]

function todayISO() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function MovimentacaoForm({ bancoId, trigger }: MovimentacaoFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [tipo, setTipo] = useState<string>('entrada')
  const [categoria, setCategoria] = useState<string>('')
  const [moeda, setMoeda] = useState<Moeda>('BRL')

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('banco_id', bancoId)
    formData.set('tipo', tipo)
    formData.set('categoria', categoria)
    formData.set('moeda', moeda)

    startTransition(async () => {
      const result = await createMovimentacao(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Movimentação registrada.')
      setOpen(false)
      form.reset()
      setTipo('entrada')
      setCategoria('')
      setMoeda('BRL')
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
            <DialogTitle>Nova movimentação</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => { if (v) setTipo(v) }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Moeda</Label>
              <Select value={moeda} onValueChange={(v) => { if (v) setMoeda(v as Moeda) }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
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
                  min={0.01}
                  step={0.01}
                  required
                  placeholder="0,00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="data">
                  Data <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="data"
                  name="data"
                  type="date"
                  required
                  defaultValue={todayISO()}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="descricao">
                Descrição <span className="text-destructive">*</span>
              </Label>
              <Input
                id="descricao"
                name="descricao"
                required
                placeholder={tipo === 'entrada' ? 'Ex: Pagamento cliente XYZ' : 'Ex: Aluguel março'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destino_origem">
                  {tipo === 'entrada' ? 'De Onde Veio' : 'Para Quem Saiu'}
                </Label>
                <Input
                  id="destino_origem"
                  name="destino_origem"
                  placeholder={tipo === 'entrada' ? 'Empresa / pessoa' : 'Fornecedor / pessoa'}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={(v) => { if (v) setCategoria(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Registrar movimentação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
