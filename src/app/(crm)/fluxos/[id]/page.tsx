import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FluxoKanbanView } from '@/components/crm/fluxos/fluxo-kanban-view'
import type { Fluxo, FluxoColuna, FluxoCard } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function FluxoKanbanPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role as 'admin' | 'socio' | 'comercial' | undefined

  // Busca o fluxo com owner
  const { data: fluxo, error: fluxoError } = await supabase
    .from('fluxos')
    .select('*, owner:profiles!owner_id(full_name)')
    .eq('id', id)
    .single()

  if (fluxoError || !fluxo) notFound()

  // RBAC: comercial só vê boards compartilhados
  if (role === 'comercial' && fluxo.visibilidade !== 'todos_comerciais') {
    redirect('/fluxos')
  }

  // Sócio só vê os próprios
  if (role === 'socio' && fluxo.owner_id !== user.id) {
    redirect('/fluxos')
  }

  // Busca colunas ordenadas
  const { data: colunas, error: colunasError } = await supabase
    .from('fluxo_colunas')
    .select('*')
    .eq('fluxo_id', id)
    .order('ordem', { ascending: true })

  if (colunasError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive">Erro ao carregar colunas. Tente novamente mais tarde.</p>
      </div>
    )
  }

  // Busca cards com responsável
  const { data: cards, error: cardsError } = await supabase
    .from('fluxo_cards')
    .select('*, responsavel:profiles!responsavel_id(full_name)')
    .eq('fluxo_id', id)
    .order('ordem', { ascending: true })

  if (cardsError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive">Erro ao carregar cards. Tente novamente mais tarde.</p>
      </div>
    )
  }

  // Monta estrutura aninhada
  const colunasComCards: FluxoColuna[] = (colunas ?? []).map((col) => ({
    ...col,
    cards: (cards ?? []).filter((c) => c.coluna_id === col.id) as FluxoCard[],
  }))

  const fluxoCompleto: Fluxo = {
    ...fluxo,
    colunas: colunasComCards,
  }

  const isOwnerOrAdmin = role === 'admin' || fluxo.owner_id === user.id

  return (
    <FluxoKanbanView
      fluxo={fluxoCompleto}
      isOwnerOrAdmin={isOwnerOrAdmin}
    />
  )
}
