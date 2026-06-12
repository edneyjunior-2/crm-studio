'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, Package, Eye, Pencil, Power } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { SolucaoForm } from './solucao-form'
import { toggleAtivo } from '@/app/(crm)/solucoes/actions'
import type { Solucao } from '@/types'

interface SolucoesGridProps {
  solucoes: Solucao[]
  isAdmin: boolean
}

function formatComissao(valor: number | null): string | null {
  if (valor === null) return null
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(valor) + '%'
}

function SolucaoCard({
  solucao,
  isAdmin,
  onToggle,
  isTogglingId,
}: {
  solucao: Solucao
  isAdmin: boolean
  onToggle: (id: string, ativo: boolean) => void
  isTogglingId: string | null
}) {
  const comissao = formatComissao(solucao.comissao_percentual)
  const isToggling = isTogglingId === solucao.id

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {solucao.nome}
          </h3>
          {solucao.empresa_representada && (
            <p className="truncate text-xs text-muted-foreground">
              {solucao.empresa_representada}
            </p>
          )}
        </div>
        <Badge variant={solucao.ativo ? 'default' : 'outline'} className="shrink-0">
          {solucao.ativo ? 'Ativa' : 'Inativa'}
        </Badge>
      </div>

      {solucao.descricao && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {solucao.descricao}
        </p>
      )}

      <div className="flex items-center gap-2">
        {comissao && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Comissão: {comissao}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/solucoes/${solucao.id}`} />}
          className="flex-1 justify-start gap-1.5"
        >
          <Eye className="size-3.5" />
          Ver detalhes
        </Button>

        {isAdmin && (
          <>
            <SolucaoForm
              solucao={solucao}
              trigger={
                <Button variant="ghost" size="icon-sm">
                  <Pencil className="size-3.5" />
                  <span className="sr-only">Editar</span>
                </Button>
              }
            />

            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isToggling}
                    className={
                      solucao.ativo
                        ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                        : 'text-muted-foreground hover:text-green-600 hover:bg-green-600/10'
                    }
                  />
                }
              >
                <Power className="size-3.5" />
                <span className="sr-only">
                  {solucao.ativo ? 'Desativar' : 'Ativar'}
                </span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {solucao.ativo ? 'Desativar solução' : 'Ativar solução'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {solucao.ativo
                      ? `"${solucao.nome}" ficará indisponível no pipeline. Negócios existentes não serão afetados.`
                      : `"${solucao.nome}" voltará a ficar disponível no pipeline.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    variant={solucao.ativo ? 'destructive' : 'default'}
                    disabled={isToggling}
                    onClick={() => onToggle(solucao.id, !solucao.ativo)}
                  >
                    {isToggling
                      ? 'Salvando...'
                      : solucao.ativo
                        ? 'Desativar'
                        : 'Ativar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  )
}

export function SolucoesGrid({ solucoes, isAdmin }: SolucoesGridProps) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filtered = solucoes.filter((s) =>
    s.nome.toLowerCase().includes(search.toLowerCase()) ||
    (s.empresa_representada?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  function handleToggle(id: string, ativo: boolean) {
    setTogglingId(id)
    startTransition(async () => {
      const result = await toggleAtivo(id, ativo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(ativo ? 'Solução ativada.' : 'Solução desativada.')
      }
      setTogglingId(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent/15">
            <Package className="size-7 text-amber-700/70" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {search ? 'Nenhuma solução encontrada' : 'Portfólio vazio por enquanto'}
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            {search
              ? 'Tente um termo diferente ou limpe a busca.'
              : isAdmin
                ? 'Adicione a primeira solução ao portfólio clicando em "Nova Solução".'
                : 'Nenhuma solução foi cadastrada ainda. Fale com o administrador.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((solucao) => (
            <SolucaoCard
              key={solucao.id}
              solucao={solucao}
              isAdmin={isAdmin}
              onToggle={handleToggle}
              isTogglingId={isPending ? togglingId : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
