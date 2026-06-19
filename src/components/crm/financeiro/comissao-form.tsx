'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
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
import { createComissao } from '@/app/(crm)/financeiro/comissoes/actions'
import type { ParceiroComissao } from '@/types'

interface ComercialUser {
  id: string
  full_name: string
}

interface NegocioBasico {
  id: string
  titulo: string
}

interface ComissaoFormProps {
  comerciais: ComercialUser[]
  negocios: NegocioBasico[]
  parceiros?: ParceiroComissao[]
  trigger?: ReactNode
}

const PIX_TIPO_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Aleatória',
}

type DestinoTipo = 'colaborador' | 'parceiro'

export function ComissaoForm({ comerciais, negocios, parceiros = [], trigger }: ComissaoFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [destinoTipo, setDestinoTipo] = useState<DestinoTipo>('colaborador')
  const [comercialId, setComercialId] = useState<string>('')
  const [parceiroId, setParceiroId] = useState<string>('')
  const [negocioId, setNegocioId] = useState<string>('none')

  const parceiroSelecionado = parceiros.find((p) => p.id === parceiroId)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    if (destinoTipo === 'colaborador') {
      formData.set('comercial_id', comercialId)
      formData.set('parceiro_id', '')
    } else {
      formData.set('comercial_id', '')
      formData.set('parceiro_id', parceiroId)
    }
    formData.set('negocio_id', negocioId === 'none' ? '' : negocioId)

    startTransition(async () => {
      const result = await createComissao(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Comissão lançada com sucesso.')
      setOpen(false)
      setComercialId('')
      setParceiroId('')
      setNegocioId('none')
      setDestinoTipo('colaborador')
      form.reset()
    })
  }

  const submitDesabilitado =
    isPending ||
    (destinoTipo === 'colaborador' && !comercialId) ||
    (destinoTipo === 'parceiro' && !parceiroId)

  return (
    <>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            Lançar Comissão
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lançar Comissão</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Destino da comissão */}
            <div className="flex flex-col gap-2">
              <Label>Destino da comissão</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDestinoTipo('colaborador')
                    setParceiroId('')
                  }}
                  className={`flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                    destinoTipo === 'colaborador'
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  Colaborador
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDestinoTipo('parceiro')
                    setComercialId('')
                  }}
                  className={`flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                    destinoTipo === 'parceiro'
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  Parceiro
                </button>
              </div>
            </div>

            {/* Seletor de colaborador */}
            {destinoTipo === 'colaborador' && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  Colaborador <span className="text-destructive">*</span>
                </Label>
                <Select value={comercialId} onValueChange={(v) => { if (v) setComercialId(v) }} required>
                  <SelectTrigger className="w-full">
                    {comercialId ? (
                      <span className="flex flex-1 truncate text-left">
                        {comerciais.find((c) => c.id === comercialId)?.full_name ?? '—'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecione o colaborador...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {comerciais.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seletor de parceiro */}
            {destinoTipo === 'parceiro' && (
              <div className="flex flex-col gap-1.5">
                <Label>
                  Parceiro <span className="text-destructive">*</span>
                </Label>
                {parceiros.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground text-center">
                    Nenhum parceiro cadastrado. Cadastre um parceiro na aba Parceiros.
                  </p>
                ) : (
                  <>
                    <Select value={parceiroId} onValueChange={(v) => { if (v) setParceiroId(v) }}>
                      <SelectTrigger className="w-full">
                        {parceiroId ? (
                          <span>{parceiroSelecionado?.nome ?? '—'}</span>
                        ) : (
                          <span className="text-muted-foreground">Selecione o parceiro...</span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {parceiros.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Dados de pagamento do parceiro selecionado */}
                    {parceiroSelecionado && (
                      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        {parceiroSelecionado.pix_tipo && parceiroSelecionado.pix_chave ? (
                          <p>
                            PIX ({PIX_TIPO_LABELS[parceiroSelecionado.pix_tipo] ?? parceiroSelecionado.pix_tipo}):{' '}
                            <span className="font-mono font-medium text-foreground">
                              {parceiroSelecionado.pix_chave}
                            </span>
                          </p>
                        ) : parceiroSelecionado.banco_nome ? (
                          <p>
                            Banco: <strong>{parceiroSelecionado.banco_nome}</strong>
                            {parceiroSelecionado.banco_agencia && ` | Ag: ${parceiroSelecionado.banco_agencia}`}
                            {parceiroSelecionado.banco_conta && ` | CC: ${parceiroSelecionado.banco_conta}`}
                          </p>
                        ) : (
                          <p className="italic">Sem dados de pagamento cadastrados.</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comissao-descricao">
                Descrição <span className="text-destructive">*</span>
              </Label>
              <Input
                id="comissao-descricao"
                name="descricao"
                required
                placeholder="Ex: Comissão venda — Cliente XYZ"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comissao-valor">
                  Valor (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="comissao-valor"
                  name="valor"
                  type="number"
                  min={0.01}
                  step={0.01}
                  required
                  placeholder="0,00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comissao-data">
                  Previsão de pagamento <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="comissao-data"
                  name="data_previsao"
                  type="date"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Negócio Relacionado</Label>
              <Select value={negocioId} onValueChange={(v) => { if (v) setNegocioId(v) }}>
                <SelectTrigger className="w-full">
                  {negocioId !== 'none' ? (
                    <span className="flex flex-1 truncate text-left">
                      {negocios.find((n) => n.id === negocioId)?.titulo ?? '—'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Opcional...</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {negocios.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comissao-obs">Observações</Label>
              <Textarea
                id="comissao-obs"
                name="observacoes"
                placeholder="Informações adicionais..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={submitDesabilitado}>
                {isPending ? 'Lançando...' : 'Lançar Comissão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
