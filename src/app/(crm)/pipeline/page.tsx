import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { listarEstagios } from '@/lib/pipeline-estagios'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/crm/pipeline/kanban-board'
import { NegocioForm } from '@/components/crm/pipeline/negocio-form'
import type { NegocioComRelacoes, Cliente, Solucao } from '@/types'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Carrega etapas dinâmicas do tenant junto com o restante em paralelo
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [estagios, solucoesResult, profileResult, profileGoogleResult] = await Promise.all([
    listarEstagios(),
    supabase.from('solucoes').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profiles').select('google_refresh_token').eq('id', user.id).single(),
  ])

  // Slugs das etapas de fechamento (ganho ou perdido) — para filtro dinâmico
  const slugsFechamento = estagios
    .filter((e) => e.tipo === 'ganho' || e.tipo === 'perdido')
    .map((e) => e.slug)
  const slugsFechamentoStr = slugsFechamento.join(',')

  let allNegocios: NegocioComRelacoes[] = []
  let clientes: Pick<Cliente, 'id' | 'razao_social'>[] = []

  try {
    ;[allNegocios, clientes] = await Promise.all([
      fetchAllRows<NegocioComRelacoes>((from, to) => {
        let q = supabase
          .from('negocios')
          .select(`
            *,
            clientes ( razao_social ),
            solucoes ( nome ),
            profiles ( full_name )
          `)
          .order('created_at', { ascending: false })
          .range(from, to)

        if (slugsFechamento.length > 0) {
          // Negócios abertos: sempre visíveis. Fechados (ganho/perdido): só do mês corrente.
          q = q.or(
            `estagio.not.in.(${slugsFechamentoStr}),` +
            `and(estagio.in.(${slugsFechamentoStr}),estagio_atualizado_em.gte.${startOfMonth}),` +
            `and(estagio.in.(${slugsFechamentoStr}),estagio_atualizado_em.is.null,updated_at.gte.${startOfMonth})`
          )
        }
        return q
      }),
      fetchAllRows<Pick<Cliente, 'id' | 'razao_social'>>((from, to) =>
        supabase.from('clientes').select('id, razao_social').order('razao_social').range(from, to)
      ),
    ])
  } catch {
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

  // comercial vê apenas os próprios negócios — RLS garante no banco,
  // mas filtramos em JS também para caso RLS não esteja habilitada
  const negocios =
    role === 'comercial'
      ? allNegocios.filter((n) => n.responsavel_id === user.id)
      : allNegocios

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
          estagios={estagios}
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
        estagios={estagios}
        googleConnected={googleConnected}
      />
    </div>
  )
}
