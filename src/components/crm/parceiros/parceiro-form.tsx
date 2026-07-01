'use client'

import { useState, useEffect, useTransition } from 'react'
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
  const [nome, setNome] = useState(parceiro?.nome ?? '')
  const [empresa, setEmpresa] = useState(parceiro?.empresa ?? '')
  const [comissaoPercentual, setComissaoPercentual] = useState<string>(
    parceiro?.comissao_percentual != null ? String(parceiro.comissao_percentual) : ''
  )
  const [contatoEmail, setContatoEmail] = useState(parceiro?.contato_email ?? '')
  const [contatoTelefone, setContatoTelefone] = useState(parceiro?.contato_telefone ?? '')
  const [dataContrato, setDataContrato] = useState(parceiro?.data_contrato ?? '')
  const [observacoes, setObservacoes] = useState(parceiro?.observacoes ?? '')
  const [contratoAssinado, setContratoAssinado] = useState(
    parceiro?.contrato_assinado ?? false
  )
  const [responsavelId, setResponsavelId] = useState(
    parceiro?.responsavel_id ?? currentUserId ?? ''
  )

  // Resincroniza todos os campos quando o parceiro muda entre aberturas do dialog
  useEffect(() => {
    if (!open) return
    setNome(parceiro?.nome ?? '')
    setEmpresa(parceiro?.empresa ?? '')
    setComissaoPercentual(parceiro?.comissao_percentual != null ? String(parceiro.comissao_percentual) : '')
    setContatoEmail(parceiro?.contato_email ?? '')
    setContatoTelefone(parceiro?.contato_telefone ?? '')
    setDataContrato(parceiro?.data_contrato ?? '')
    setObservacoes(parceiro?.observacoes ?? '')
    setContratoAssinado(parceiro?.contrato_assinado ?? false)
    setResponsavelId(parceiro?.responsavel_id ?? currentUserId ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parceiro?.id])

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData()
    formData.set('nome', nome)
    formData.set('empresa', empresa)
    formData.set('comissao_percentual', comissaoPercentual)
    formData.set('contato_email', contatoEmail)
    formData.set('contato_telefone', contatoTelefone)
    formData.set('data_contrato', dataContrato)
    formData.set('observacoes', observacoes)
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
        setNome('')
        setEmpresa('')
        setComissaoPercentual('')
        setContatoEmail('')
        setContatoTelefone('')
        setDataContrato('')
        setObservacoes('')
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
                value={nome}
                onChange={(e) => setNome(e.target.value)}
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
                    <span className="flex flex-1 text-left line-clamp-1 text-sm">
                      {responsavelId
                        ? (profiles.find(p => p.id === responsavelId)?.full_name ?? responsavelId)
                        : <span className="text-muted-foreground">Selecione o responsável</span>}
                    </span>
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
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
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
                value={comissaoPercentual}
                onChange={(e) => setComissaoPercentual(e.target.value)}
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
                  value={contatoEmail}
                  onChange={(e) => setContatoEmail(e.target.value)}
                  placeholder="email@empresa.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contato_telefone">Telefone</Label>
                <Input
                  id="contato_telefone"
                  name="contato_telefone"
                  value={contatoTelefone}
                  onChange={(e) => setContatoTelefone(e.target.value)}
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
                  value={dataContrato}
                  onChange={(e) => setDataContrato(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
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
