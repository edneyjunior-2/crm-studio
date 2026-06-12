'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, Pencil, Trash2, Building2, Check } from 'lucide-react'
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
import { FornecedorForm } from '@/components/crm/financeiro/fornecedor-form'
import { deleteFornecedor } from '@/app/(crm)/financeiro/fornecedores/actions'
import type { Fornecedor } from '@/types'

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

interface FornecedoresTableProps {
  fornecedores: Fornecedor[]
}

export function FornecedoresTable({ fornecedores }: FornecedoresTableProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteFornecedor(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Fornecedor excluído.')
    })
  }

  if (fornecedores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
        <Building2 className="mb-2 size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado ainda.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Use o botão acima para cadastrar um fornecedor com dados de PIX.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Nome</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">WhatsApp</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tipo PIX</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Chave PIX</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {fornecedores.map((f) => (
            <tr
              key={f.id}
              className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-foreground">{f.nome}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {f.telefone ? (
                  <span className="font-mono text-xs">{f.telefone}</span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {f.pix_tipo ? (
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {PIX_TIPO_LABELS[f.pix_tipo] ?? f.pix_tipo}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {f.pix_chave ? (
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-foreground">{f.pix_chave}</span>
                    <CopyButton value={f.pix_chave} />
                  </div>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <FornecedorForm
                    fornecedor={f}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Editar fornecedor"
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
                          title="Excluir fornecedor"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        />
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir fornecedor</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir <strong>{f.nome}</strong>? Esta ação não pode
                          ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => handleDelete(f.id)}
                        >
                          {isPending ? 'Excluindo...' : 'Excluir'}
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
