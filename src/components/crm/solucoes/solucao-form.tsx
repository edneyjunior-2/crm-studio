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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { createSolucao, updateSolucao } from '@/app/(crm)/solucoes/actions'
import type { Solucao } from '@/types'

interface SolucaoFormProps {
  solucao?: Solucao
  trigger: React.ReactNode
}

export function SolucaoForm({ solucao, trigger }: SolucaoFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [ativo, setAtivo] = useState(solucao?.ativo ?? true)

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('ativo', String(ativo))

    startTransition(async () => {
      const result = solucao
        ? await updateSolucao(solucao.id, formData)
        : await createSolucao(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        solucao ? 'Solução atualizada com sucesso.' : 'Solução cadastrada com sucesso.'
      )
      setOpen(false)
      if (!solucao) {
        form.reset()
        setAtivo(true)
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
              {solucao ? 'Editar solução' : 'Nova solução'}
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
                defaultValue={solucao?.nome}
                placeholder="Nome da solução"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="empresa_representada">Empresa representada</Label>
              <Input
                id="empresa_representada"
                name="empresa_representada"
                defaultValue={solucao?.empresa_representada ?? ''}
                placeholder="Ex: Microsoft, SAP..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                name="descricao"
                defaultValue={solucao?.descricao ?? ''}
                placeholder="Descreva a solução..."
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comissao_percentual">Comissão (%)</Label>
              <Input
                id="comissao_percentual"
                name="comissao_percentual"
                type="number"
                min={0}
                max={100}
                step={0.5}
                defaultValue={solucao?.comissao_percentual ?? ''}
                placeholder="Ex: 12,5"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="ativo-switch" className="cursor-pointer">
                  Solução ativa
                </Label>
                <span className="text-xs text-muted-foreground">
                  Soluções inativas não aparecem no pipeline.
                </span>
              </div>
              <Switch
                id="ativo-switch"
                checked={ativo}
                onCheckedChange={setAtivo}
              />
            </div>

            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" type="button" />}
              >
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Salvando...'
                  : solucao
                    ? 'Salvar alterações'
                    : 'Cadastrar solução'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
