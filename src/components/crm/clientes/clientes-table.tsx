'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Eye, Pencil, Trash2, Search, Users, Shield, Globe } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { ClienteForm } from './cliente-form'
import { deleteCliente } from '@/app/(crm)/clientes/actions'
import type { Cliente } from '@/types'
import { formatCNPJ, formatCPF } from '@/lib/masks'

interface ClientesTableProps {
  clientes: Cliente[]
}

export function ClientesTable({ clientes }: ClientesTableProps) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)

  const filtered = clientes.filter((c) =>
    c.razao_social.toLowerCase().includes(search.toLowerCase())
  )

  function handleDelete(id: string, razaoSocial: string) {
    startTransition(async () => {
      const result = await deleteCliente(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`"${razaoSocial}" removido com sucesso.`)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por razão social..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/8">
            <Users className="size-7 text-primary/60" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            {search
              ? 'Tente um termo diferente ou limpe a busca.'
              : 'Adicione o primeiro cliente à sua carteira clicando em "Novo Cliente".'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão Social</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="sticky right-0 w-28 bg-card text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cliente) => (
                <TableRow
                  key={cliente.id}
                  onClick={() => setEditingCliente(cliente)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">
                    {cliente.razao_social}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cliente.tipo_pessoa === 'pf'
                      ? (cliente.cpf ? formatCPF(cliente.cpf) : '—')
                      : (cliente.cnpj ? formatCNPJ(cliente.cnpj) : '—')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cliente.contato_nome ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cliente.profiles?.full_name ?? '—'}
                  </TableCell>
                  <TableCell>
                    {cliente.area_tipo === 'privada' ? (
                      <StatusBadge variant="privada" className="gap-1">
                        <Shield className="size-3" />
                        Privada
                      </StatusBadge>
                    ) : cliente.area_tipo === 'publica' ? (
                      <StatusBadge variant="publica" className="gap-1">
                        <Globe className="size-3" />
                        Pública
                      </StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cliente.segmento ? (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {cliente.segmento}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    className="sticky right-0 bg-card"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        nativeButton={false}
                        render={<Link href={`/clientes/${cliente.id}`} />}
                      >
                        <Eye className="size-3.5" />
                        <span className="sr-only">Ver detalhes</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingCliente(cliente)}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            />
                          }
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Excluir</span>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir{' '}
                              <strong>{cliente.razao_social}</strong>? Esta ação
                              não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              disabled={isPending}
                              onClick={() =>
                                handleDelete(cliente.id, cliente.razao_social)
                              }
                            >
                              {isPending ? 'Excluindo...' : 'Excluir'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ClienteForm
        cliente={editingCliente ?? undefined}
        open={editingCliente !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingCliente(null)
        }}
      />
    </div>
  )
}
