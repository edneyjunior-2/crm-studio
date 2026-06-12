'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createFluxo, updateFluxo } from '@/app/(crm)/fluxos/actions'
import type { Fluxo } from '@/types'

interface FluxoFormProps {
  trigger: React.ReactNode
  fluxo?: Fluxo
  onSuccess?: () => void
}

export function FluxoForm({ trigger, fluxo, onSuccess }: FluxoFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [visibilidade, setVisibilidade] = useState<'privado' | 'todos_comerciais'>(
    fluxo?.visibilidade ?? 'privado'
  )
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('visibilidade', visibilidade)

    startTransition(async () => {
      const result = fluxo
        ? await updateFluxo(fluxo.id, formData)
        : await createFluxo(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(fluxo ? 'Fluxo atualizado com sucesso!' : 'Fluxo criado com sucesso!')
      setOpen(false)
      formRef.current?.reset()
      onSuccess?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fluxo ? 'Editar Fluxo' : 'Novo Fluxo'}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fluxo-titulo">Título *</Label>
            <Input
              id="fluxo-titulo"
              name="titulo"
              defaultValue={fluxo?.titulo}
              placeholder="Ex: Onboarding de Cliente"
              required
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fluxo-descricao">Descrição</Label>
            <Input
              id="fluxo-descricao"
              name="descricao"
              defaultValue={fluxo?.descricao ?? ''}
              placeholder="Descreva o objetivo deste fluxo"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Visibilidade</Label>
            <Select
              value={visibilidade}
              onValueChange={(v) => setVisibilidade(v as 'privado' | 'todos_comerciais')}
              disabled={isPending}
            >
              <SelectTrigger>
                <span className="flex flex-1 text-left line-clamp-1">
                  {visibilidade === 'privado' ? 'Privado (somente eu e admin)' : 'Compartilhado (todos os comerciais)'}
                </span>
              </SelectTrigger>
              <SelectContent className="min-w-max">
                <SelectItem value="privado">Privado (somente eu e admin)</SelectItem>
                <SelectItem value="todos_comerciais">Compartilhado (todos os comerciais)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : fluxo ? 'Salvar' : 'Criar Fluxo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
