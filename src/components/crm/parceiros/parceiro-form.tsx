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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createParceiro, updateParceiro } from '@/app/(crm)/parceiros/actions'
import type { Parceiro } from '@/types'

interface ParceiroFormProps {
  parceiro?: Parceiro
  trigger: React.ReactNode
  profiles?: { id: string; full_name: string }[]
  currentUserId?: string
}

export function ParceiroForm({ parceiro, trigger, profiles = [], currentUserId }: ParceiroFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [contratoAssinado, setContratoAssinado] = useState(
    parceiro?.contrato_assinado ?? false
  )
  const [responsavelId, setResponsavelId] = useState(
    parceiro?.responsavel_id ?? currentUserId ?? ''
  )

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('contrato_assinado', String(contratoAssinado))
    formData.set('responsavel_id', responsavelId)

    startTransition(async () => {
      const result = parceiro
        ? await updateParceiro(parceiro.id, formData)
        : await createParceiro(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        parceiro ? 'Parceiro atualizado com sucesso.' : 'Parceiro cadastrado com sucesso.'
      )
      setOpen(false)
      if (!parceiro) {
        form.reset()
        setContratoAssinado(false)
        setResponsavelId(currentUserId ?? '')
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
              {parceiro ? 'Editar parceiro' : 'Novo parceiro'}
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
                defaultValue={parceiro?.nome ?? ''}
                placeholder="Nome do parceiro"
              />
            </div>

            {profiles.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="responsavel_id">
                  Responsável <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={responsavelId}
                  onValueChange={(v) => setResponsavelId(v ?? '')}
                  name="responsavel_id"
                >
                  <SelectTrigger id="responsavel_id">
                    {responsavelId ? (
                      <span className="flex flex-1 text-left line-clamp-1">
                        {profiles.find(p => p.id === responsavelId)?.full_name ?? responsavelId}
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecione o responsável" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="empresa">Empresa</Label>
              <Input
                id="empresa"
                name="empresa"
                defaultValue={parceiro?.empresa ?? ''}
                placeholder="Razão social ou nome fantasia"
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
                defaultValue={parceiro?.comissao_percentual ?? ''}
                placeholder="Ex: 5,0"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contato_email">E-mail</Label>
                <Input
                  id="contato_email"
                  name="contato_email"
                  type="email"
                  defaultValue={parceiro?.contato_email ?? ''}
                  placeholder="email@empresa.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contato_telefone">Telefone</Label>
                <Input
                  id="contato_telefone"
                  name="contato_telefone"
                  defaultValue={parceiro?.contato_telefone ?? ''}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="contrato_assinado" className="cursor-pointer">
                  Contrato assinado?
                </Label>
                <span className="text-xs text-muted-foreground">
                  Indica se há contrato formal com este parceiro
                </span>
              </div>
              <Switch
                id="contrato_assinado"
                checked={contratoAssinado}
                onCheckedChange={setContratoAssinado}
              />
            </div>

            {contratoAssinado && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="data_contrato">Data do Contrato</Label>
                <Input
                  id="data_contrato"
                  name="data_contrato"
                  type="date"
                  defaultValue={parceiro?.data_contrato ?? ''}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                defaultValue={parceiro?.observacoes ?? ''}
                placeholder="Informações adicionais sobre o parceiro..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Salvando...'
                  : parceiro
                    ? 'Salvar alterações'
                    : 'Cadastrar parceiro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
