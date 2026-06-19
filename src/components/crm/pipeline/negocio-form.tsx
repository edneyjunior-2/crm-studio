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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { createNegocio, updateNegocio } from '@/app/(crm)/pipeline/actions'
import type { NegocioComRelacoes, EstagioNegocio, Cliente, Solucao } from '@/types'

const ESTAGIOS: { value: EstagioNegocio; label: string }[] = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechado_ganho', label: 'Fechado Ganho' },
  { value: 'fechado_perdido', label: 'Fechado Perdido' },
]

interface NegocioFormProps {
  negocio?: NegocioComRelacoes
  clientes: Pick<Cliente, 'id' | 'razao_social'>[]
  solucoes: Pick<Solucao, 'id' | 'nome'>[]
  trigger: React.ReactNode
  defaultEstagio?: EstagioNegocio
}

export function NegocioForm({
  negocio,
  clientes,
  solucoes,
  trigger,
  defaultEstagio,
}: NegocioFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [estagio, setEstagio] = useState<EstagioNegocio>(
    negocio?.estagio ?? defaultEstagio ?? 'prospeccao'
  )
  const [clienteId, setClienteId] = useState<string | null>(negocio?.cliente_id ?? null)
  const [solucaoId, setSolucaoId] = useState<string | null>(negocio?.solucao_id ?? null)

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('estagio', estagio)
    formData.set('cliente_id', clienteId ?? '')
    formData.set('solucao_id', solucaoId ?? '')

    startTransition(async () => {
      const result = negocio
        ? await updateNegocio(negocio.id, formData)
        : await createNegocio(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        negocio ? 'Negócio atualizado com sucesso.' : 'Negócio criado com sucesso.'
      )
      setOpen(false)
      if (!negocio) {
        form.reset()
        setEstagio(defaultEstagio ?? 'prospeccao')
        setClienteId(null)
        setSolucaoId(null)
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
              {negocio ? 'Editar negócio' : 'Novo negócio'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="titulo"
                name="titulo"
                required
                defaultValue={negocio?.titulo}
                placeholder="Ex: Implantação ERP — Empresa XYZ"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>
                  Cliente <span className="text-destructive">*</span>
                </Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger className="w-full">
                    {clienteId ? (
                      <span className="flex flex-1 truncate text-left">
                        {clientes.find((c) => c.id === clienteId)?.razao_social ?? '—'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecione...</span>
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
                <Label>
                  Solução <span className="text-destructive">*</span>
                </Label>
                <Select value={solucaoId} onValueChange={setSolucaoId}>
                  <SelectTrigger className="w-full">
                    {solucaoId ? (
                      <span className="flex flex-1 truncate text-left">
                        {solucoes.find((s) => s.id === solucaoId)?.nome ?? '—'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecione...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {solucoes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                Estágio <span className="text-destructive">*</span>
              </Label>
              <Select
                value={estagio}
                onValueChange={(v) => setEstagio(v as EstagioNegocio)}
              >
                <SelectTrigger className="w-full">
                  {ESTAGIOS.find((e) => e.value === estagio)?.label ?? (
                    <span className="text-muted-foreground">Selecione...</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {ESTAGIOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="valor_estimado">Valor estimado (R$)</Label>
                <Input
                  id="valor_estimado"
                  name="valor_estimado"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={negocio?.valor_estimado ?? ''}
                  placeholder="0,00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="probabilidade">Probabilidade (%)</Label>
                <Input
                  id="probabilidade"
                  name="probabilidade"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={negocio?.probabilidade ?? ''}
                  placeholder="0 a 100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data_previsao_fechamento">Previsão de Fechamento</Label>
              <Input
                id="data_previsao_fechamento"
                name="data_previsao_fechamento"
                type="date"
                defaultValue={negocio?.data_previsao_fechamento ?? ''}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                defaultValue={negocio?.observacoes ?? ''}
                placeholder="Informações adicionais sobre o negócio..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button
                type="submit"
                disabled={isPending || !clienteId || !solucaoId}
              >
                {isPending
                  ? 'Salvando...'
                  : negocio
                    ? 'Salvar alterações'
                    : 'Criar negócio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
