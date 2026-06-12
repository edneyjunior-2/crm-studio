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
import { QrCode } from 'lucide-react'
import { createBanco, updateBanco } from '@/app/(crm)/financeiro/bancos/actions'
import type { Banco } from '@/types'

interface BancoFormProps {
  banco?: Banco
  trigger: React.ReactNode
}

const TIPO_OPTIONS = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'caixa', label: 'Caixa' },
]

const PIX_TIPOS = [
  { value: 'cpf',      label: 'CPF',             placeholder: '000.000.000-00' },
  { value: 'cnpj',     label: 'CNPJ',            placeholder: '00.000.000/0001-00' },
  { value: 'email',    label: 'E-mail',           placeholder: 'nome@email.com' },
  { value: 'telefone', label: 'Telefone',         placeholder: '+55 11 99999-9999' },
  { value: 'aleatoria',label: 'Chave Aleatória',  placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
]

export function BancoForm({ banco, trigger }: BancoFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [tipo, setTipo] = useState<string>(banco?.tipo ?? 'corrente')
  const [pixTipo, setPixTipo] = useState<string>(banco?.pix_tipo ?? '')
  const [pixChave, setPixChave] = useState<string>(banco?.pix_chave ?? '')


  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('tipo', tipo)
    formData.set('pix_tipo', pixTipo)
    formData.set('pix_chave', pixChave)

    startTransition(async () => {
      const result = banco
        ? await updateBanco(banco.id, formData)
        : await createBanco(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        banco ? 'Conta bancária atualizada.' : 'Conta bancária cadastrada.'
      )
      setOpen(false)
      if (!banco) {
        form.reset()
        setTipo('corrente')
        setPixTipo('')
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {banco ? 'Editar conta bancária' : 'Nova conta bancária'}
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
                defaultValue={banco?.nome ?? ''}
                placeholder="Ex: Conta principal Itaú"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="instituicao">Instituição</Label>
                <Input
                  id="instituicao"
                  name="instituicao"
                  defaultValue={banco?.instituicao ?? ''}
                  placeholder="Ex: Itaú, Bradesco, Nubank"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => { if (v) setTipo(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agencia">Agência</Label>
                <Input
                  id="agencia"
                  name="agencia"
                  defaultValue={banco?.agencia ?? ''}
                  placeholder="0000"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="conta">Conta</Label>
                <Input
                  id="conta"
                  name="conta"
                  defaultValue={banco?.conta ?? ''}
                  placeholder="00000-0"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="saldo_inicial">Saldo Inicial (R$)</Label>
              <Input
                id="saldo_inicial"
                name="saldo_inicial"
                type="number"
                min={0}
                step={0.01}
                defaultValue={banco?.saldo_inicial ?? 0}
                placeholder="0,00"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Chave PIX (opcional)</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Tipo de Chave</Label>
                  <Select value={pixTipo} onValueChange={(v) => { setPixTipo(v ?? ''); setPixChave('') }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione..." />
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

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pix_chave">Chave</Label>
                  <Input
                    id="pix_chave"
                    value={pixChave}
                    onChange={(e) => setPixChave(e.target.value)}
                    disabled={!pixTipo}
                    placeholder={PIX_TIPOS.find((t) => t.value === pixTipo)?.placeholder ?? '—'}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Salvando...'
                  : banco
                    ? 'Salvar alterações'
                    : 'Cadastrar conta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
