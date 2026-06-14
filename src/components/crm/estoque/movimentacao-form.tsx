'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { registrarMovimentacao } from '@/app/(crm)/estoque/actions'
import type { Produto, TipoMovimentacao } from '@/types/estoque'

const TIPOS: { value: TipoMovimentacao; label: string; descricao: string }[] = [
  { value: 'entrada', label: 'Entrada',  descricao: 'Adiciona ao saldo (compra, produção)' },
  { value: 'saida',   label: 'Saída',    descricao: 'Remove do saldo (venda, consumo)' },
  { value: 'ajuste',  label: 'Ajuste',   descricao: 'Corrige o saldo (inventário); use negativo para reduzir' },
]

function localDateToString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface MovimentacaoFormProps {
  produtos: Pick<Produto, 'id' | 'nome' | 'unidade' | 'saldo_atual'>[]
  trigger: React.ReactNode
  /** Pré-seleciona um produto ao abrir */
  produtoIdInicial?: string
}

export function MovimentacaoForm({ produtos, trigger, produtoIdInicial }: MovimentacaoFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [produtoId, setProdutoId] = useState<string>(produtoIdInicial ?? '')
  const [tipo, setTipo] = useState<TipoMovimentacao>('entrada')

  const produtoSelecionado = produtos.find((p) => p.id === produtoId) ?? null

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('produto_id', produtoId)
    formData.set('tipo', tipo)

    startTransition(async () => {
      const result = await registrarMovimentacao(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Movimentação registrada.')
      setOpen(false)
      form.reset()
      setProdutoId(produtoIdInicial ?? '')
      setTipo('entrada')
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar movimentação</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Produto */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Produto <span className="text-destructive">*</span>
              </Label>
              <Select value={produtoId} onValueChange={(v) => { if (v) setProdutoId(v) }}>
                <SelectTrigger className="w-full">
                  {/* Renderizar label manualmente (padrão UUID-safe) */}
                  {produtoId ? (
                    <span className="flex flex-1 truncate text-left">
                      {produtoSelecionado?.nome ?? 'Produto não encontrado'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Selecione o produto...</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {produtos.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      Nenhum produto cadastrado
                    </SelectItem>
                  ) : (
                    produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {produtoSelecionado && (
                <p className="text-xs text-muted-foreground">
                  Saldo atual: <strong>{produtoSelecionado.saldo_atual} {produtoSelecionado.unidade}</strong>
                </p>
              )}
            </div>

            {/* Tipo */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select value={tipo} onValueChange={(v) => { if (v) setTipo(v as TipoMovimentacao) }}>
                <SelectTrigger className="w-full">
                  {/* Renderizar label manualmente (padrão UUID-safe) */}
                  <span className="flex flex-1 truncate text-left">
                    {TIPOS.find((t) => t.value === tipo)?.label ?? tipo}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TIPOS.find((t) => t.value === tipo)?.descricao}
              </p>
            </div>

            {/* Quantidade + Custo unitário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantidade">
                  Quantidade <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  step={0.001}
                  required
                  placeholder={tipo === 'ajuste' ? 'Positivo ou negativo' : '0'}
                  min={tipo === 'ajuste' ? undefined : 0.001}
                />
              </div>

              {tipo === 'entrada' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="custo_unitario">Custo unitário (R$)</Label>
                  <Input
                    id="custo_unitario"
                    name="custo_unitario"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0,00"
                  />
                </div>
              )}
            </div>

            {/* Data */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data">
                Data <span className="text-destructive">*</span>
              </Label>
              <Input
                id="data"
                name="data"
                type="date"
                required
                defaultValue={localDateToString(new Date())}
              />
            </div>

            {/* Motivo */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="motivo">Motivo / Observação</Label>
              <Textarea
                id="motivo"
                name="motivo"
                rows={2}
                className="resize-none"
                placeholder="Ex: Compra NF 1234, perda por avaria, inventário..."
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending || !produtoId}>
                {isPending ? 'Salvando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
