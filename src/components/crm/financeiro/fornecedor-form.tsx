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
import { createFornecedor, updateFornecedor } from '@/app/(crm)/financeiro/fornecedores/actions'
import type { Fornecedor } from '@/types'
import { formatCNPJ, formatCPF } from '@/lib/masks'

const PIX_TIPOS = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
]

interface FornecedorFormProps {
  fornecedor?: Fornecedor
  trigger: React.ReactNode
}

export function FornecedorForm({ fornecedor, trigger }: FornecedorFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pixTipo, setPixTipo] = useState<string | null>(fornecedor?.pix_tipo ?? null)
  const [pixChave, setPixChave] = useState(fornecedor?.pix_chave ?? '')

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handlePixChaveChange(value: string) {
    if (pixTipo === 'cnpj') setPixChave(formatCNPJ(value))
    else if (pixTipo === 'cpf') setPixChave(formatCPF(value))
    else setPixChave(value)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('pix_tipo', pixTipo ?? '')

    startTransition(async () => {
      const result = fornecedor
        ? await updateFornecedor(fornecedor.id, formData)
        : await createFornecedor(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(fornecedor ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.')
      setOpen(false)
      if (!fornecedor) {
        form.reset()
        setPixTipo(null)
        setPixChave('')
      }
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
            <DialogTitle>
              {fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                name="nome"
                required
                defaultValue={fornecedor?.nome}
                placeholder="Ex: Provedor de Internet"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefone">WhatsApp</Label>
              <Input
                id="telefone"
                name="telefone"
                defaultValue={fornecedor?.telefone ?? ''}
                placeholder="Ex: 11999887766"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Tipo de Chave PIX</Label>
              <Select
                value={pixTipo ?? ''}
                onValueChange={(v) => setPixTipo(v || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione (opcional)..." />
                </SelectTrigger>
                <SelectContent>
                  {PIX_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pixTipo && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pix_chave">
                  Chave PIX <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pix_chave"
                  name="pix_chave"
                  required
                  value={pixChave}
                  onChange={(e) => handlePixChaveChange(e.target.value)}
                  placeholder={
                    pixTipo === 'cpf'
                      ? '000.000.000-00'
                      : pixTipo === 'cnpj'
                      ? '00.000.000/0001-00'
                      : pixTipo === 'email'
                      ? 'email@exemplo.com'
                      : pixTipo === 'telefone'
                      ? '11999887766'
                      : 'Chave aleatória'
                  }
                />
              </div>
            )}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Salvando...'
                  : fornecedor
                  ? 'Salvar alterações'
                  : 'Cadastrar fornecedor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
