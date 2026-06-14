'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Search, Pencil, UserX, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { ColaboradorForm } from './colaborador-form'
import { desligarColaborador } from '@/app/(crm)/rh/actions'
import type { Colaborador } from '@/types/rh'
import {
  COLABORADOR_STATUS_LABEL,
  TIPO_CONTRATO_LABEL,
} from '@/types/rh'

function formatarData(dataBR: string | null): string {
  if (!dataBR) return '—'
  // dataBR: 'YYYY-MM-DD'
  const [ano, mes, dia] = dataBR.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

function StatusBadge({ status }: { status: Colaborador['status'] }) {
  const variantMap: Record<Colaborador['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    ativo: 'default',
    afastado: 'secondary',
    desligado: 'destructive',
  }
  return (
    <Badge variant={variantMap[status]}>
      {COLABORADOR_STATUS_LABEL[status]}
    </Badge>
  )
}

interface ColaboradoresTableProps {
  colaboradores: Colaborador[]
}

export function ColaboradoresTable({ colaboradores }: ColaboradoresTableProps) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [desligandoId, setDesligandoId] = useState<string | null>(null)

  const hoje = new Date()
  const hojeStr = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, '0'),
    String(hoje.getDate()).padStart(2, '0'),
  ].join('-')

  const filtered = colaboradores.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.cargo ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.departamento ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function handleDesligar(id: string) {
    setDesligandoId(id)
    startTransition(async () => {
      const result = await desligarColaborador(id, hojeStr)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Colaborador desligado.')
      }
      setDesligandoId(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cargo ou departamento..."
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
            {search ? 'Nenhum colaborador encontrado' : 'Nenhum colaborador cadastrado ainda'}
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            {search
              ? 'Tente um termo diferente ou limpe a busca.'
              : 'Adicione o primeiro colaborador clicando em "Novo Colaborador".'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((colaborador) => (
                <TableRow key={colaborador.id}>
                  <TableCell className="font-medium">{colaborador.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatarCpf(colaborador.cpf)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {colaborador.cargo ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {colaborador.departamento ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {colaborador.tipo_contrato
                      ? TIPO_CONTRATO_LABEL[colaborador.tipo_contrato]
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatarData(colaborador.data_admissao)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={colaborador.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <ColaboradorForm
                        colaborador={colaborador}
                        trigger={
                          <Button variant="ghost" size="icon-sm">
                            <Pencil className="size-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        }
                      />

                      {colaborador.status !== 'desligado' && (
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
                            <UserX className="size-3.5" />
                            <span className="sr-only">Desligar</span>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Desligar colaborador</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja desligar{' '}
                                <strong>{colaborador.nome}</strong>? A data de
                                desligamento será definida como hoje.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                disabled={isPending && desligandoId === colaborador.id}
                                onClick={() => handleDesligar(colaborador.id)}
                              >
                                {isPending && desligandoId === colaborador.id
                                  ? 'Desligando...'
                                  : 'Desligar'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
