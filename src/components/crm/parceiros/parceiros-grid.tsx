'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Pencil, Trash2, Mail, Phone, CalendarCheck, Handshake, UserCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
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
import { ParceiroForm } from './parceiro-form'
import { deleteParceiro } from '@/app/(crm)/parceiros/actions'
import type { Parceiro } from '@/types'

interface ParceirosGridProps {
  parceiros: Parceiro[]
  canEdit: boolean
  profiles?: { id: string; full_name: string }[]
  currentUserId?: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteParceiro(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Parceiro excluído.')
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir parceiro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O parceiro será removido permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ParceirosGrid({ parceiros, canEdit, profiles = [], currentUserId = '' }: ParceirosGridProps) {
  const router = useRouter()
  const [busca, setBusca] = useState('')

  const parceirosFiltrados = parceiros.filter((p) => {
    const termo = busca.toLowerCase()
    return (
      p.nome.toLowerCase().includes(termo) ||
      (p.empresa?.toLowerCase().includes(termo) ?? false)
    )
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou empresa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {parceirosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/8">
            <Handshake className="size-7 text-primary/60" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {busca ? 'Nenhum parceiro encontrado' : 'Nenhum parceiro cadastrado ainda'}
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            {busca
              ? 'Tente outro termo de busca.'
              : 'Registre o primeiro parceiro ou indicador usando o botão acima.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parceirosFiltrados.map((parceiro) => (
            <div
              key={parceiro.id}
              onClick={() => router.push(`/parceiros/${parceiro.id}`)}
              className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="truncate font-semibold text-foreground">{parceiro.nome}</p>
                  {parceiro.empresa && (
                    <p className="truncate text-sm text-muted-foreground">{parceiro.empresa}</p>
                  )}
                </div>
                {canEdit && (
                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ParceiroForm
                      parceiro={parceiro}
                      profiles={profiles}
                      currentUserId={currentUserId}
                      trigger={
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <DeleteButton id={parceiro.id} />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {parceiro.contato_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{parceiro.contato_email}</span>
                  </div>
                )}
                {parceiro.contato_telefone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" />
                    <span>{parceiro.contato_telefone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {parceiro.contrato_assinado ? (
                  <StatusBadge variant="contrato_assinado">
                    Contrato Assinado
                  </StatusBadge>
                ) : (
                  <StatusBadge variant="sem_contrato">
                    Sem Contrato
                  </StatusBadge>
                )}
                {parceiro.contrato_assinado && parceiro.data_contrato && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarCheck className="size-3.5" />
                    <span>{formatDate(parceiro.data_contrato)}</span>
                  </div>
                )}
                {parceiro.comissao_percentual != null && (
                  <StatusBadge variant="comissao">
                    {parceiro.comissao_percentual}%
                  </StatusBadge>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserCircle className="size-3.5 shrink-0" />
                <span>
                  {parceiro.responsavel?.full_name ??
                    profiles.find((p) => p.id === parceiro.responsavel_id)?.full_name ??
                    '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
