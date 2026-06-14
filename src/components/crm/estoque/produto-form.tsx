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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { createProduto, updateProduto } from '@/app/(crm)/estoque/actions'
import type { Produto } from '@/types/estoque'

const UNIDADES = [
  { value: 'un',  label: 'Unidade (un)' },
  { value: 'kg',  label: 'Quilograma (kg)' },
  { value: 'g',   label: 'Grama (g)' },
  { value: 'l',   label: 'Litro (l)' },
  { value: 'ml',  label: 'Mililitro (ml)' },
  { value: 'm',   label: 'Metro (m)' },
  { value: 'cx',  label: 'Caixa (cx)' },
  { value: 'pc',  label: 'Peça (pc)' },
  { value: 'par', label: 'Par (par)' },
]

interface ProdutoFormProps {
  produto?: Produto
  trigger: React.ReactNode
}

export function ProdutoForm({ produto, trigger }: ProdutoFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [unidade, setUnidade] = useState<string>(produto?.unidade ?? 'un')

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('unidade', unidade)

    startTransition(async () => {
      const result = produto
        ? await updateProduto(produto.id, formData)
        : await createProduto(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(produto ? 'Produto atualizado.' : 'Produto cadastrado.')
      setOpen(false)
      if (!produto) {
        form.reset()
        setUnidade('un')
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
              {produto ? 'Editar produto' : 'Novo produto'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Nome */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                name="nome"
                required
                defaultValue={produto?.nome ?? ''}
                placeholder="Ex: Camiseta Básica P"
              />
            </div>

            {/* SKU + Unidade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sku">SKU / Código</Label>
                <Input
                  id="sku"
                  name="sku"
                  defaultValue={produto?.sku ?? ''}
                  placeholder="Ex: CAM-001-P"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Unidade</Label>
                <Select value={unidade} onValueChange={(v) => { if (v) setUnidade(v) }}>
                  <SelectTrigger className="w-full">
                    {/* Renderizar label manualmente (UUID-safe pattern) */}
                    <span className="flex flex-1 truncate text-left">
                      {UNIDADES.find((u) => u.value === unidade)?.label ?? unidade}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preços */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="custo_medio">Custo médio (R$)</Label>
                <Input
                  id="custo_medio"
                  name="custo_medio"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={produto?.custo_medio ?? '0'}
                  placeholder="0,00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preco_venda">Preço de venda (R$)</Label>
                <Input
                  id="preco_venda"
                  name="preco_venda"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={produto?.preco_venda ?? '0'}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Estoque mínimo */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="estoque_minimo">Estoque mínimo</Label>
              <Input
                id="estoque_minimo"
                name="estoque_minimo"
                type="number"
                min={0}
                step={0.001}
                defaultValue={produto?.estoque_minimo ?? '0'}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Produtos com saldo abaixo deste valor serão sinalizados em vermelho.
              </p>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : produto ? 'Salvar alterações' : 'Cadastrar produto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
