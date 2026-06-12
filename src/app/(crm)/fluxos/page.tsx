import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutTemplate, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FluxoForm } from '@/components/crm/fluxos/fluxo-form'
import type { Fluxo } from '@/types'

export default async function FluxosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as 'admin' | 'socio' | 'comercial' | undefined

  let query = supabase
    .from('fluxos')
    .select('*, owner:profiles!owner_id(full_name)')
    .order('created_at', { ascending: false })

  if (role === 'socio') {
    query = query.eq('owner_id', user.id)
  } else if (role === 'comercial') {
    query = query.eq('visibilidade', 'todos_comerciais')
  }

  const { data: fluxos, error } = await query

  const canManage = role === 'admin' || role === 'socio'

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Fluxos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Boards Kanban para processos internos.</p>
        </div>
        <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm text-destructive">Erro ao carregar fluxos. Tente novamente mais tarde.</p>
        </div>
      </div>
    )
  }

  const lista = (fluxos ?? []) as (Fluxo & { owner: { full_name: string } | null })[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Fluxos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Boards Kanban para processos internos, onboarding e checklists.
          </p>
        </div>
        {canManage && (
          <FluxoForm
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo Fluxo
              </Button>
            }
          />
        )}
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-20 text-center gap-4">
          <LayoutTemplate className="size-12 text-muted-foreground/30" />
          <div>
            <p className="text-base font-medium text-foreground">Nenhum fluxo encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManage
                ? 'Crie seu primeiro fluxo para organizar processos internos.'
                : 'Nenhum fluxo foi compartilhado com você ainda.'}
            </p>
          </div>
          {canManage && (
            <FluxoForm
              trigger={
                <Button variant="outline">
                  <Plus className="size-4" />
                  Criar primeiro fluxo
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((fluxo) => (
            <Link
              key={fluxo.id}
              href={`/fluxos/${fluxo.id}`}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                    {fluxo.titulo}
                  </span>
                  {fluxo.descricao && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {fluxo.descricao}
                    </p>
                  )}
                </div>
                <Badge
                  variant={fluxo.visibilidade === 'todos_comerciais' ? 'default' : 'secondary'}
                  className="shrink-0 text-[11px]"
                >
                  {fluxo.visibilidade === 'todos_comerciais' ? 'Compartilhado' : 'Privado'}
                </Badge>
              </div>

              {fluxo.owner && (
                <p className="text-xs text-muted-foreground">
                  Criado por {fluxo.owner.full_name}
                </p>
              )}

              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {new Date(fluxo.created_at).toLocaleDateString('pt-BR')}
                </span>
                <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
