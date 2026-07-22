import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { listarEstagios } from '@/lib/pipeline-estagios'
import { getAuthUser } from '@/lib/auth'
import { getPipelineConfig } from '@/lib/pipeline-config'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/crm/pipeline/kanban-board'
import { PipelineParceiro } from './pipeline-parceiro'
import { NegocioForm } from '@/components/crm/pipeline/negocio-form'
import type { NegocioComRelacoes, Cliente, Solucao, Parceiro, Profile, Role } from '@/types'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // empresaId EFETIVO (empresa_ativa_id p/ platform admin) — nunca ler
  // profiles.empresa_id direto aqui (ver studio-padroes-multitenant-rls).
  const auth = await getAuthUser()

  // Parceiro externo tem visão própria, só leitura, antes de qualquer carga:
  // os fetches abaixo (clientes, parceiros, profiles, soluções) batem em
  // tabelas que a RLS nega pra ele e alimentam formulário/drag que ele não usa.
  if (auth.role === 'parceiro') return <PipelineParceiro />

  // Carrega etapas dinâmicas do tenant junto com o restante em paralelo
  const now = new Date()
  // Primeiro dia do mês corrente em formato YYYY-MM-DD (sem toISOString, para evitar virada de UTC)
  const primeiroDiaMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [estagios, solucoesResult, profileResult, profileGoogleResult, parceirosResult, profilesResult, pipelineConfig] = await Promise.all([
    listarEstagios(),
    supabase.from('solucoes').select('id, nome').eq('ativo', true).order('nome'),
    // papeis(permissoes): permissão fina do papel do usuário (Fase 2 — spec
    // papeis-customizaveis-02-permissao-pipeline.md). Sem hint: única FK
    // profiles.papel_id -> papeis.id, sem ambiguidade.
    supabase.from('profiles').select('role, papeis(permissoes)').eq('id', user.id).single(),
    supabase.from('profiles').select('google_refresh_token').eq('id', user.id).single(),
    supabase.from('parceiros').select('id, nome').order('nome'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    getPipelineConfig(supabase, auth.empresaId),
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
            profiles!responsavel_id ( full_name ),
            parceiros ( nome ),
            indicador:profiles!indicado_por ( full_name )
          `)
          .order('created_at', { ascending: false })
          .eq('desqualificado', false)
          .range(from, to)

        if (slugsFechamento.length > 0) {
          // Negócios abertos (data_fechamento NULL): sempre visíveis.
          // Fechados (ganho/perdido): só do mês corrente (data_fechamento >= primeiro dia do mês).
          q = q.or(
            `data_fechamento.is.null,data_fechamento.gte.${primeiroDiaMes}`
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

  const role = (profileResult.data?.role ?? 'comercial') as Role
  const podeVerPipelineCompleto = !!(
    profileResult.data as { papeis?: { permissoes?: { pipeline_visao_completa?: boolean } } | null } | null
  )?.papeis?.permissoes?.pipeline_visao_completa

  // comercial vê apenas os próprios negócios — RLS garante no banco, mas
  // filtramos em JS também para caso RLS não esteja habilitada. Exceção: papel
  // com a permissão pipeline_visao_completa ligada (Fase 2 — spec
  // papeis-customizaveis-02-permissao-pipeline.md) vê tudo, sem virar sócio.
  const negocios =
    role === 'comercial' && !podeVerPipelineCompleto
      ? allNegocios.filter((n) => n.responsavel_id === user.id)
      : allNegocios

  const solucoes = (solucoesResult.data ?? []) as Pick<Solucao, 'id' | 'nome'>[]
  const googleConnected = !!profileGoogleResult.data?.google_refresh_token
  const parceiros = (parceirosResult.data ?? []) as Pick<Parceiro, 'id' | 'nome'>[]
  const membrosTime = (profilesResult.data ?? []) as Pick<Profile, 'id' | 'full_name'>[]

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
          parceiros={parceiros}
          membrosTime={membrosTime}
          pipelineConfig={pipelineConfig}
          currentUserId={user.id}
          currentUserRole={role}
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
        parceiros={parceiros}
        membrosTime={membrosTime}
        pipelineConfig={pipelineConfig}
      />
    </div>
  )
}
