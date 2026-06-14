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
import { createColaborador, updateColaborador } from '@/app/(crm)/rh/actions'
import type { Colaborador, ColaboradorStatus, TipoContrato } from '@/types/rh'
import {
  COLABORADOR_STATUS_LABEL,
  TIPO_CONTRATO_LABEL,
} from '@/types/rh'

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

interface ColaboradorFormProps {
  colaborador?: Colaborador
  trigger: React.ReactNode
}

export function ColaboradorForm({ colaborador, trigger }: ColaboradorFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isEdicao = !!colaborador

  // Campos controlados para formatação
  const [cpf, setCpf] = useState(colaborador?.cpf ?? '')
  const [telefone, setTelefone] = useState(colaborador?.telefone ?? '')

  // Selects com UUID/enum — renderizamos o label manualmente no trigger (convenção Base UI)
  const [status, setStatus] = useState<ColaboradorStatus>(colaborador?.status ?? 'ativo')
  const [tipoContrato, setTipoContrato] = useState<TipoContrato | ''>(
    colaborador?.tipo_contrato ?? ''
  )

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function resetForm() {
    setCpf('')
    setTelefone('')
    setStatus('ativo')
    setTipoContrato('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    // Sobrescrever com valores dos states controlados
    formData.set('cpf', cpf)
    formData.set('telefone', telefone)
    formData.set('status', status)
    formData.set('tipo_contrato', tipoContrato)

    startTransition(async () => {
      const result = isEdicao
        ? await updateColaborador(colaborador.id, formData)
        : await createColaborador(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(isEdicao ? 'Colaborador atualizado.' : 'Colaborador cadastrado.')
      setOpen(false)
      if (!isEdicao) resetForm()
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEdicao ? 'Editar colaborador' : 'Novo colaborador'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-1">

              {/* Nome */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nome">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  name="nome"
                  required
                  defaultValue={colaborador?.nome ?? ''}
                  placeholder="Nome completo"
                />
              </div>

              {/* CPF */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>

              {/* Cargo e Departamento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    name="cargo"
                    defaultValue={colaborador?.cargo ?? ''}
                    placeholder="Ex: Analista"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Input
                    id="departamento"
                    name="departamento"
                    defaultValue={colaborador?.departamento ?? ''}
                    placeholder="Ex: Comercial"
                  />
                </div>
              </div>

              {/* E-mail e Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={colaborador?.email ?? ''}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    name="telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              {/* Tipo de contrato */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                {/* Renderizamos o label manualmente no trigger (convenção Base UI Select) */}
                <Select
                  value={tipoContrato || undefined}
                  onValueChange={(v) => setTipoContrato(v as TipoContrato)}
                >
                  <SelectTrigger id="tipo_contrato" className="w-full">
                    {tipoContrato ? (
                      <span className="flex flex-1 text-left">
                        {TIPO_CONTRATO_LABEL[tipoContrato as TipoContrato]}
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecione..." />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_CONTRATO_LABEL) as TipoContrato[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {TIPO_CONTRATO_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status">
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as ColaboradorStatus)}
                >
                  <SelectTrigger id="status" className="w-full">
                    {/* Label renderizado manualmente — convenção Base UI */}
                    <span className="flex flex-1 text-left">
                      {COLABORADOR_STATUS_LABEL[status]}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COLABORADOR_STATUS_LABEL) as ColaboradorStatus[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {COLABORADOR_STATUS_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Salário */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="salario">Salário (R$)</Label>
                <Input
                  id="salario"
                  name="salario"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={colaborador?.salario ?? ''}
                  placeholder="0,00"
                />
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="data_admissao">Data de Admissão</Label>
                  <Input
                    id="data_admissao"
                    name="data_admissao"
                    type="date"
                    defaultValue={colaborador?.data_admissao ?? ''}
                  />
                </div>
                {isEdicao && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="data_desligamento">Data de Desligamento</Label>
                    <Input
                      id="data_desligamento"
                      name="data_desligamento"
                      type="date"
                      defaultValue={colaborador?.data_desligamento ?? ''}
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : isEdicao ? (
                  'Salvar alterações'
                ) : (
                  'Cadastrar colaborador'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
