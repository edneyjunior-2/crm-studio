'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, Pencil, PowerOff, Handshake, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ParceiroComissaoForm } from '@/components/crm/financeiro/parceiro-comissao-form'
import { inativarParceiroComissao } from '@/app/(crm)/financeiro/parceiros/actions'
import type { ParceiroComissao } from '@/types'

const PIX_TIPO_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Aleatória',
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title="Copiar chave PIX"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </Button>
  )
}

interface ParceirosComissaoTableProps {
  parceiros: ParceiroComissao[]
}

export function ParceirosComissaoTable({ parceiros }: ParceirosComissaoTableProps) {
  const [isPending, startTransition] = useTransition()

  function handleInativar(id: string) {
    startTransition(async () => {
      const result = await inativarParceiroComissao(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Parceiro inativado.')
    })
  }

  if (parceiros.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
        <Handshake className="mb-2 size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum parceiro cadastrado ainda.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Cadastre parceiros para lançar comissões a eles.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Nome</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">CNPJ</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Contato</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pagamento</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {parceiros.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-foreground">{p.nome}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.cnpj ? (
                  <span className="font-mono text-xs">{p.cnpj}</span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <div className="flex flex-col gap-0.5">
                  {p.contato_nome && <span>{p.contato_nome}</span>}
                  {p.contato_email && (
                    <span className="text-xs text-muted-foreground/60">{p.contato_email}</span>
                  )}
                  {!p.contato_nome && !p.contato_email && (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                {p.pix_tipo && p.pix_chave ? (
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {PIX_TIPO_LABELS[p.pix_tipo] ?? p.pix_tipo}
                    </span>
                    <span className="font-mono text-xs text-foreground">{p.pix_chave}</span>
                    <CopyButton value={p.pix_chave} />
                  </div>
                ) : p.banco_nome ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">{p.banco_nome}</span>
                    {p.banco_agencia && p.banco_conta && (
                      <span className="font-mono text-xs text-muted-foreground">
                        Ag: {p.banco_agencia} / CC: {p.banco_conta}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <ParceiroComissaoForm
                    parceiro={p}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Editar parceiro"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Inativar parceiro"
                          className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                        />
                      }
                    >
                      <PowerOff className="size-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Inativar parceiro</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja inativar <strong>{p.nome}</strong>?
                          O parceiro não aparecerá mais nas opções de lançamento de comissão.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => handleInativar(p.id)}
                        >
                          {isPending ? 'Inativando...' : 'Inativar'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
