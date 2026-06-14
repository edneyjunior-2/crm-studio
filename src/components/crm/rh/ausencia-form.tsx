'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registrarAusencia } from '@/app/(crm)/rh/actions'
import type { Colaborador, TipoAusencia } from '@/types/rh'
import { TIPO_AUSENCIA_LABEL } from '@/types/rh'

interface AusenciaFormProps {
  colaboradores: Pick<Colaborador, 'id' | 'nome'>[]
  trigger: React.ReactNode
}

export function AusenciaForm({ colaboradores, trigger }: AusenciaFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Selects com label renderizado manualmente (convenção Base UI dentro de Dialog)
  const [colaboradorId, setColaboradorId] = useState<string>('')
  const [tipo, setTipo] = useState<string>('')

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function resetForm(form: HTMLFormElement) {
    form.reset()
    setColaboradorId('')
    setTipo('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    formData.set('colaborador_id', colaboradorId)
    formData.set('tipo', tipo)

    startTransition(async () => {
      const result = await registrarAusencia(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Ausência registrada.')
      setOpen(false)
      resetForm(form)
    })
  }

  const colaboradorSelecionado = colaboradores.find((c) => c.id === colaboradorId)

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Ausência</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-1">

              {/* Colaborador */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="colaborador_id">
                  Colaborador <span className="text-destructive">*</span>
                </Label>
                {/* UUID Select dentro de Dialog — label no trigger, não SelectValue */}
                <Select
                  value={colaboradorId || undefined}
                  onValueChange={(v) => setColaboradorId(v ?? '')}
                >
                  <SelectTrigger id="colaborador_id" className="w-full">
                    {colaboradorSelecionado ? (
                      <span className="flex flex-1 text-left line-clamp-1">
                        {colaboradorSelecionado.nome}
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecione o colaborador..." />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        Nenhum colaborador ativo
                      </SelectItem>
                    ) : (
                      colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de ausência */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tipo">
                  Tipo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={tipo || undefined}
                  onValueChange={(v) => setTipo(v ?? '')}
                >
                  <SelectTrigger id="tipo" className="w-full">
                    {tipo ? (
                      <span className="flex flex-1 text-left">
                        {TIPO_AUSENCIA_LABEL[tipo as TipoAusencia] ?? tipo}
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecione o tipo..." />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_AUSENCIA_LABEL) as TipoAusencia[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {TIPO_AUSENCIA_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="data_inicio">
                    Data de Início <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="data_inicio"
                    name="data_inicio"
                    type="date"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="data_fim">Data de Fim</Label>
                  <Input
                    id="data_fim"
                    name="data_fim"
                    type="date"
                  />
                </div>
              </div>

              {/* Observação */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="observacao">Observação</Label>
                <Input
                  id="observacao"
                  name="observacao"
                  placeholder="Detalhes adicionais..."
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button
                type="submit"
                disabled={isPending || !colaboradorId || !tipo}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Registrar ausência'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
