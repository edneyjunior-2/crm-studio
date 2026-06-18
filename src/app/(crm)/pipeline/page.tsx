import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/crm/pipeline/kanban-board'
import { NegocioForm } from '@/components/crm/pipeline/negocio-form'
import type { NegocioComRelacoes, Cliente, Solucao } from '@/types'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Todas as queries em paralelo — profile incluído no mesmo Promise.all
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [negociosResult, clientesResult, solucoesResult, profileResult, profileGoogleResult] = await Promise.all([
    supabase
      .from('negocios')
      .select(`
        *,
        clientes ( razao_social ),
        solucoes ( nome ),
        profiles ( full_name )
      `)
      // Pipeline mostra: negócios não-fechados + fechados (ganho OU perdido) do mês corrente
      .or(
        `estagio.not.in.(fechado_ganho,fechado_perdido),` +
        `and(estagio.in.(fechado_ganho,fechado_perdido),estagio_atualizado_em.gte.${startOfMonth}),` +
        `and(estagio.in.(fechado_ganho,fechado_perdido),estagio_atualizado_em.is.null,updated_at.gte.${startOfMonth})`
      )
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, razao_social').order('razao_social'),
    supabase.from('solucoes').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profiles').select('google_refresh_token').eq('id', user.id).single(),
  ])

  if (negociosResult.error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Pipeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">Funil de vendas por estágio.</p>
          </div>
        </div>
        <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm text-destructive">
            Erro ao carregar negócios. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    )
  }

  const role = profileResult.data?.role
  const allNegocios = (negociosResult.data ?? []) as NegocioComRelacoes[]

  // comercial vê apenas os próprios negócios — RLS garante no banco,
  // mas filtramos em JS também para caso RLS não esteja habilitada
  const negocios =
    role === 'comercial'
      ? allNegocios.filter((n) => n.responsavel_id === user.id)
      : allNegocios

  const clientes = (clientesResult.data ?? []) as Pick<Cliente, 'id' | 'razao_social'>[]
  const solucoes = (solucoesResult.data ?? []) as Pick<Solucao, 'id' | 'nome'>[]
  const googleConnected = !!profileGoogleResult.data?.google_refresh_token

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Pipeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seus negócios por estágio do funil.
          </p>
        </div>
        <NegocioForm
          clientes={clientes}
          solucoes={solucoes}
          trigger={
            <Button>
              <Plus className="size-4" />
              Novo Negócio
            </Button>
          }
        />
      </div>

      <KanbanBoard
        negocios={negocios}
        clientes={clientes}
        solucoes={solucoes}
        googleConnected={googleConnected}
      />
    </div>
  )
}
