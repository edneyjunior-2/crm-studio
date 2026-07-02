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
  SelectValue,
} from '@/components/ui/select'
import { createParceiroComissao, updateParceiroComissao } from '@/app/(crm)/financeiro/parceiros/actions'
import type { ParceiroComissao } from '@/types'
import { formatCNPJ, formatCPF } from '@/lib/masks'

const PIX_TIPOS = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
]

type PagamentoModo = 'pix' | 'banco' | null

interface ParceiroComissaoFormProps {
  parceiro?: ParceiroComissao
  trigger: React.ReactNode
}

export function ParceiroComissaoForm({ parceiro, trigger }: ParceiroComissaoFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [cnpj, setCnpj] = useState(parceiro?.cnpj ?? '')
  const [pixTipo, setPixTipo] = useState<string | null>(parceiro?.pix_tipo ?? null)
  const [pixChave, setPixChave] = useState(parceiro?.pix_chave ?? '')
  const [pagamentoModo, setPagamentoModo] = useState<PagamentoModo>(() => {
    if (parceiro?.pix_tipo) return 'pix'
    if (parceiro?.banco_nome || parceiro?.banco_agencia || parceiro?.banco_conta) return 'banco'
    return null
  })

  function handlePixChaveChange(value: string) {
    if (pixTipo === 'cnpj') setPixChave(formatCNPJ(value))
    else if (pixTipo === 'cpf') setPixChave(formatCPF(value))
    else setPixChave(value)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handlePagamentoModo(modo: PagamentoModo) {
    setPagamentoModo(modo)
    if (modo !== 'pix') setPixTipo(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('pix_tipo', pagamentoModo === 'pix' ? (pixTipo ?? '') : '')
    if (pagamentoModo !== 'pix') {
      formData.set('pix_chave', '')
    }
    if (pagamentoModo !== 'banco') {
      formData.set('banco_nome', '')
      formData.set('banco_agencia', '')
      formData.set('banco_conta', '')
    }

    startTransition(async () => {
      const result = parceiro
        ? await updateParceiroComissao(parceiro.id, formData)
        : await createParceiroComissao(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(parceiro ? 'Parceiro atualizado.' : 'Parceiro cadastrado.')
      setOpen(false)
      if (!parceiro) {
        form.reset()
        setCnpj('')
        setPixTipo(null)
        setPixChave('')
        setPagamentoModo(null)
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
            {/* Dados principais */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                name="nome"
                required
                defaultValue={parceiro?.nome}
                placeholder="Nome do parceiro ou empresa"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                name="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                placeholder="00.000.000/0001-00"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contato_nome">Nome do Contato</Label>
                <Input
                  id="contato_nome"
                  name="contato_nome"
                  defaultValue={parceiro?.contato_nome ?? ''}
                  placeholder="Nome"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contato_email">E-mail</Label>
                <Input
                  id="contato_email"
                  name="contato_email"
                  type="email"
                  defaultValue={parceiro?.contato_email ?? ''}
                  placeholder="email@exemplo.com"
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

            {/* Dados de pagamento */}
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">Dados de Pagamento</p>
              <p className="text-xs text-muted-foreground">
                Escolha como o parceiro recebe o pagamento das comissões.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePagamentoModo(pagamentoModo === 'pix' ? null : 'pix')}
                  className={`flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                    pagamentoModo === 'pix'
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  PIX
                </button>
                <button
                  type="button"
                  onClick={() => handlePagamentoModo(pagamentoModo === 'banco' ? null : 'banco')}
                  className={`flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                    pagamentoModo === 'banco'
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  Dados Bancários
                </button>
              </div>

              {pagamentoModo === 'pix' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Tipo de Chave PIX</Label>
                    <Select
                      value={pixTipo ?? ''}
                      onValueChange={(v) => setPixTipo(v || null)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o tipo..." />
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
                </div>
              )}

              {pagamentoModo === 'banco' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="banco_nome">Banco</Label>
                    <Input
                      id="banco_nome"
                      name="banco_nome"
                      defaultValue={parceiro?.banco_nome ?? ''}
                      placeholder="Ex: Itaú"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="banco_agencia">Agência</Label>
                    <Input
                      id="banco_agencia"
                      name="banco_agencia"
                      defaultValue={parceiro?.banco_agencia ?? ''}
                      placeholder="0000"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="banco_conta">Conta</Label>
                    <Input
                      id="banco_conta"
                      name="banco_conta"
                      defaultValue={parceiro?.banco_conta ?? ''}
                      placeholder="00000-0"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                defaultValue={parceiro?.observacoes ?? ''}
                placeholder="Informações adicionais sobre o parceiro..."
                rows={2}
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
