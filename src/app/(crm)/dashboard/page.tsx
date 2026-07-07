import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/auth'
import { TrendingUp, DollarSign, BarChart3, CalendarClock, Star, ArrowRight } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { PipelineChart } from '@/components/crm/dashboard/pipeline-chart'
import { FollowupsWidget } from '@/components/crm/dashboard/followups-widget'
import { ConversaoFunil } from '@/components/crm/dashboard/conversao-funil'
import { ReunioesWidget } from '@/components/crm/dashboard/reunioes-widget'
import { MetricasAnimadas, type MetricaCard } from '@/components/crm/dashboard/metricas-animadas'
import { VisaoExecutiva } from '@/components/crm/dashboard/visao-executiva'
import type { DonutFatia, ProdutoFatia, IndicadorItem } from '@/components/crm/dashboard/visao-executiva'
import { listEvents, isConfigured } from '@/lib/google-calendar'
import { listarEstagios } from '@/lib/pipeline-estagios'
import { mapaEstagios, corPorTipo } from '@/lib/estagios-ui'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { unstable_cache } from 'next/cache'
import type { NegocioComRelacoes, Followup } from '@/types'

// Paleta de cores hex para os donuts (por tipo/posição)
const CORES_TIPO: Record<string, string> = {
  aberto: '#64748b',   // slate-500
  ganho:  '#10b981',   // emerald-500
  perdido: '#ef4444',  // red-500
}

// Paleta adicional para produtos (rotativa)
const PALETA_PRODUTOS = [
  '#6366f1', // indigo-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
]

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function todayISO() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function plusDaysISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default async function DashboardPage() {
  // Usa o cache do layout — zero round-trip extra ao Supabase Auth
  const { supabase, user, role, empresaId } = await getAuthUser()
  if (!user) redirect('/login')

  // Parceiro (externo) não tem dashboard — mostraria pipeline/financeiro do
  // escritório inteiro, fora do escopo dele. Home dele é a lista de processos.
  if (role === 'parceiro') redirect('/processos')

  const today = todayISO()
  const sevenDaysLater = plusDaysISO(7)

  const now = new Date()
  const mesAtualInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const proximoMes = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const mesAtualFim = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}-01`

  const isFinanceiro = role === 'admin' || role === 'socio'

  // Tudo em paralelo — uma única rodada de queries
  const [
    { data: profile },
    { count: totalClientes },
    negociosAll,
    { data: empresa },
    estagios,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    fetchAllRows<NegocioComRelacoes>(
      (from, to) =>
        supabase
          .from('negocios')
          .select('*, clientes(razao_social), solucoes(nome), profiles!responsavel_id(full_name)')
          .order('updated_at', { ascending: false })
          .range(from, to)
    ),
    empresaId
      ? supabase.from('empresas').select('nome').eq('id', empresaId).single()
      : Promise.resolve({ data: null }),
    listarEstagios(),
  ])

  const mapa = mapaEstagios(estagios)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'time'

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const dataHeader = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Segundo Promise.all: queries que dependem do role
  // contasReceber: usamos fetchAllRows para evitar o cap de 1000 linhas do PostgREST
  const contasReceberRows = isFinanceiro
    ? await fetchAllRows<{ valor: number; data_recebimento: string; status: string }>(
        (from, to) =>
          supabase
            .from('contas_receber')
            .select('valor, data_recebimento, status')
            .eq('status', 'recebido')
            .gte('data_recebimento', mesAtualInicio)
            .lt('data_recebimento', mesAtualFim)
            .range(from, to)
      ).catch(() => [] as { valor: number; data_recebimento: string; status: string }[])
    : null

  const [
    { data: followupsData },
    { data: solucoesDestaqueRaw },
    reunioesResult,
  ] = await Promise.all([
    isFinanceiro
      ? supabase
          .from('followups')
          .select('*, negocios(titulo, clientes(razao_social))')
          .lte('data_agendada', today)
          .eq('status', 'pendente')
          .order('data_agendada', { ascending: true })
      : supabase
          .from('followups')
          .select('*, negocios(titulo, clientes(razao_social))')
          .lte('data_agendada', today)
          .eq('status', 'pendente')
          .eq('responsavel_id', user.id)
          .order('data_agendada', { ascending: true }),
    // Soluções em destaque genéricas: as 4 ativas com mais negócios não-perdidos no pipeline.
    // Sem filtro por nome hardcoded — white-label para qualquer tenant.
    supabase
      .from('solucoes')
      .select('id, nome, descricao, empresa_representada, comissao_percentual')
      .eq('ativo', true),
    isConfigured()
      ? unstable_cache(
          () => listEvents(`${today}T00:00:00-03:00`, `${plusDaysISO(1)}T23:59:59-03:00`).catch(() => []),
          [`gcal-eventos-${today}`],
          { revalidate: 300 }, // cache por 5 minutos
        )()
      : Promise.resolve([]),
  ])

  const negociosList = negociosAll

  const todosEventos = Array.isArray(reunioesResult) ? reunioesResult : []
  const amanha = plusDaysISO(1)
  const reunioesHoje   = todosEventos.filter((ev) => (ev.start?.dateTime ?? ev.start?.date ?? '').startsWith(today))
  const reunioesAmanha = todosEventos.filter((ev) => (ev.start?.dateTime ?? ev.start?.date ?? '').startsWith(amanha))

  // Top 4 soluções ativas por negócios não-perdidos no pipeline (genérico, sem nome fixo)
  const solucoesDestaque = (solucoesDestaqueRaw ?? [])
    .map((sol) => {
      const negociosAtivos = negociosList.filter(
        (n) => n.solucao_id === sol.id && mapa[n.estagio]?.tipo !== 'perdido'
      ).length
      const valorPipeline = negociosList
        .filter((n) => n.solucao_id === sol.id && mapa[n.estagio]?.tipo !== 'perdido')
        .reduce((s, n) => s + Number(n.valor_estimado ?? 0), 0)
      return { ...sol, negociosAtivos, valorPipeline }
    })
    .sort((a, b) => b.negociosAtivos - a.negociosAtivos || b.valorPipeline - a.valorPipeline)
    .slice(0, 4)
    .filter((sol) => sol.negociosAtivos > 0)

  // Derivar negóciosPrazo em JS a partir dos dados já carregados — sem round-trip extra
  const negociosPrazoList = negociosList
    .filter(
      (n) =>
        n.data_previsao_fechamento !== null &&
        n.data_previsao_fechamento >= today &&
        n.data_previsao_fechamento <= sevenDaysLater &&
        mapa[n.estagio]?.tipo === 'aberto'
    )
    .sort((a, b) =>
      (a.data_previsao_fechamento ?? '').localeCompare(b.data_previsao_fechamento ?? '')
    )

  const followupsPendentes = (followupsData ?? []) as Followup[]

  const ativos = negociosList.filter((n) => mapa[n.estagio]?.tipo === 'aberto')
  const totalAtivos = ativos.length
  const valorPipeline = ativos.reduce((s, n) => s + Number(n.valor_estimado ?? 0), 0)

  const fechadosGanhoMes = negociosList.filter(
    (n) =>
      mapa[n.estagio]?.tipo === 'ganho' &&
      n.updated_at >= mesAtualInicio &&
      n.updated_at < mesAtualFim
  ).length

  const receitaMes = isFinanceiro
    ? (contasReceberRows ?? []).reduce((s, c) => s + Number(c.valor), 0)
    : null

  const contagensPorEstagio = negociosList.reduce(
    (acc, n) => {
      acc[n.estagio] = (acc[n.estagio] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // ─── Visão Executiva: dados para os 3 gráficos ───────────────────────────────

  // 1. Donut Pipeline: valor por etapa (somente negócios não-perdidos)
  const valorPorEstagio = negociosList.reduce(
    (acc, n) => {
      if (mapa[n.estagio]?.tipo === 'perdido') return acc
      acc[n.estagio] = (acc[n.estagio] ?? 0) + Number(n.valor_estimado ?? 0)
      return acc
    },
    {} as Record<string, number>
  )

  const fatiasEstagio: DonutFatia[] = estagios
    .filter((e) => e.tipo !== 'perdido' && (valorPorEstagio[e.slug] ?? 0) > 0)
    .sort((a, b) => a.ordem - b.ordem)
    .map((e) => ({
      slug: e.slug,
      nome: e.nome,
      valor: valorPorEstagio[e.slug] ?? 0,
      cor: e.cor ?? CORES_TIPO[e.tipo] ?? '#64748b',
      corHex: e.cor ?? CORES_TIPO[e.tipo] ?? '#64748b',
    }))

  const totalFatiasEstagio = fatiasEstagio.reduce((s, f) => s + f.valor, 0)
  const totalNegociosPipeline = negociosList.filter((n) => mapa[n.estagio]?.tipo !== 'perdido').length

  // 2. Donut Produtos: negocio_produtos por solucao_id, excluindo negócios perdidos
  // Obtemos o set de IDs não-perdidos a partir dos dados já carregados (sem round-trip extra)
  const negociosNaoPerdidosIds = new Set(
    negociosList.filter((n) => mapa[n.estagio]?.tipo !== 'perdido').map((n) => n.id)
  )

  let negocioProdutosRaw: Array<{ negocio_id: string; solucao_id: string | null; valor: number }> = []
  try {
    negocioProdutosRaw = await fetchAllRows<{ negocio_id: string; solucao_id: string | null; valor: number }>(
      (from, to) =>
        supabase
          .from('negocio_produtos')
          .select('negocio_id, solucao_id, valor')
          .range(from, to)
    )
  } catch {
    // tolera falha: gráfico mostra vazio
  }

  // Filtrar somente produtos de negócios não-perdidos
  const negocioProdutosFiltrados = negocioProdutosRaw.filter(
    (p) => negociosNaoPerdidosIds.has(p.negocio_id)
  )

  // Busca nomes das soluções para montar a legenda
  const solucaoIdsNeeded = [
    ...new Set(negocioProdutosFiltrados.map((p) => p.solucao_id).filter(Boolean)),
  ] as string[]

  const solucaoNomeMap: Record<string, string> = {}
  if (solucaoIdsNeeded.length > 0) {
    const { data: solsData } = await supabase
      .from('solucoes')
      .select('id, nome')
      .in('id', solucaoIdsNeeded)
    for (const s of solsData ?? []) solucaoNomeMap[s.id] = s.nome
  }

  const valorPorSolucao = negocioProdutosFiltrados.reduce(
    (acc, p) => {
      const key = p.solucao_id ?? '__sem_solucao'
      acc[key] = (acc[key] ?? 0) + Number(p.valor ?? 0)
      return acc
    },
    {} as Record<string, number>
  )

  const todasFatiasOrdenadas = Object.entries(valorPorSolucao)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)

  const top8 = todasFatiasOrdenadas.slice(0, 8)
  const restantes = todasFatiasOrdenadas.slice(8)

  const fatiasProduotos: ProdutoFatia[] = [
    ...top8.map(([key, valor], i) => ({
      solucao_id: key === '__sem_solucao' ? null : key,
      nome: key === '__sem_solucao' ? 'Sem produto' : (solucaoNomeMap[key] ?? 'Produto'),
      valor,
      corHex: PALETA_PRODUTOS[i % PALETA_PRODUTOS.length],
    })),
    ...(restantes.length > 0
      ? [
          {
            solucao_id: null,
            nome: 'Outros',
            valor: restantes.reduce((s, [, v]) => s + v, 0),
            corHex: '#94a3b8', // slate-400
          },
        ]
      : []),
  ]

  const totalFatiasProdutos = fatiasProduotos.reduce((s, f) => s + f.valor, 0)

  // 3. Barras Indicadores: soma valor_estimado por indicador (parceiro ou membro do time)
  // Coletar IDs de parceiros e de profiles (indicado_por)
  const parceiroAcc: Record<string, number> = {}
  const internoAcc: Record<string, number> = {}

  for (const n of negociosList) {
    const valor = Number(n.valor_estimado ?? 0)
    if (!valor) continue
    if (n.parceiro_id) {
      parceiroAcc[n.parceiro_id] = (parceiroAcc[n.parceiro_id] ?? 0) + valor
    } else if (n.indicado_por) {
      internoAcc[n.indicado_por] = (internoAcc[n.indicado_por] ?? 0) + valor
    }
  }

  // Resolver nomes
  const parceiroIds = Object.keys(parceiroAcc)
  const internoIds = Object.keys(internoAcc)

  const [parceirosNomes, internasNomes] = await Promise.all([
    parceiroIds.length > 0
      ? supabase.from('parceiros').select('id, nome').in('id', parceiroIds)
      : Promise.resolve({ data: [] }),
    internoIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', internoIds)
      : Promise.resolve({ data: [] }),
  ])

  const parceiroNomeMap: Record<string, string> = {}
  for (const p of parceirosNomes.data ?? []) parceiroNomeMap[p.id] = p.nome

  const internoNomeMap: Record<string, string> = {}
  for (const p of internasNomes.data ?? []) internoNomeMap[p.id] = p.full_name

  const indicadoresRaw: IndicadorItem[] = [
    ...parceiroIds.map((id) => ({
      id: `parceiro_${id}`,
      nome: parceiroNomeMap[id] ?? 'Parceiro',
      valor: parceiroAcc[id],
      tipo: 'parceiro' as const,
    })),
    ...internoIds.map((id) => ({
      id: `interno_${id}`,
      nome: internoNomeMap[id] ?? 'Colaborador',
      valor: internoAcc[id],
      tipo: 'interno' as const,
    })),
  ]

  const topIndicadores: IndicadorItem[] = indicadoresRaw
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6)

  // ─────────────────────────────────────────────────────────────────────────────

  const metricCards: MetricaCard[] = [
    {
      label: 'Total de Clientes',
      icon: 'Users',
      value: totalClientes?.toString() ?? '—',
      description: 'clientes cadastrados',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      label: 'Negócios Ativos',
      icon: 'TrendingUp',
      value: totalAtivos.toString(),
      description: 'em andamento no pipeline',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Pipeline Total',
      icon: 'BarChart3',
      value: BRL(valorPipeline),
      description: 'valor estimado em aberto',
      iconBg: 'bg-accent/20',
      iconColor: 'text-amber-700',
    },
    ...(isFinanceiro
      ? [
          {
            label: 'Receita do Mês',
            icon: 'DollarSign',
            value: BRL(receitaMes ?? 0),
            description: 'recebido no mês atual',
            iconBg: 'bg-violet-500/10',
            iconColor: 'text-violet-600',
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground capitalize">
            {dataHeader}{empresa?.nome ? ` · ${empresa.nome}` : ''}
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
            {saudacao}, {firstName}
          </h2>
        </div>
        {reunioesHoje.length > 0 && (
          <Link
            href="/calendario"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.08] py-3 transition-colors hover:bg-primary/[0.14]"
          >
            <span className="size-2 rounded-full bg-primary" />
            <span className="text-sm font-semibold text-primary">
              {reunioesHoje.length} reunião{reunioesHoje.length !== 1 ? 'ões' : ''} hoje — ver calendário
            </span>
          </Link>
        )}
      </div>

      <MetricasAnimadas cards={metricCards} isFinanceiro={isFinanceiro} />

      <ReunioesWidget hoje={reunioesHoje} amanha={reunioesAmanha} />

      {solucoesDestaque.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Soluções em Destaque
            </h3>
            <Link href="/solucoes" className="text-xs font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {solucoesDestaque.map((sol) => (
              <Link
                href="/pipeline"
                key={sol.id}
                className="group relative flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-5 shadow-sm transition-all hover:bg-primary/[0.07] hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="absolute right-4 top-4">
                  <StatusBadge variant="proposta" className="gap-1 text-[10px] font-bold uppercase tracking-wider">
                    <Star className="size-2.5 fill-amber-500 text-amber-500" />
                    Destaque
                  </StatusBadge>
                </div>

                <div className="flex flex-col gap-1 pr-20">
                  <p className="text-lg font-bold text-foreground leading-tight">{sol.nome}</p>
                  {sol.empresa_representada && (
                    <p className="text-xs text-muted-foreground">{sol.empresa_representada}</p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="size-3.5 text-emerald-500" />
                    <span className="text-sm font-semibold text-foreground">{sol.negociosAtivos}</span>
                    <span className="text-xs text-muted-foreground">negócios ativos</span>
                  </div>
                  <div className="h-3 w-px bg-border" />
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-primary" />
                    <span className="truncate tabular-nums text-sm font-semibold text-foreground">{BRL(sol.valorPipeline)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <span>Ver no Pipeline</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Pipeline
          </h3>
          <Link
            href="/pipeline"
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver tudo
          </Link>
        </div>

        <PipelineChart estagios={estagios} contagens={contagensPorEstagio} />

        <ConversaoFunil estagios={estagios} contagens={contagensPorEstagio} />

        <FollowupsWidget followups={followupsPendentes} />

        {negociosPrazoList.length > 0 && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <CalendarClock className="size-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Prazo nos próximos 7 dias
              </h3>
              <StatusBadge variant="proposta" className="ml-auto flex size-5 items-center justify-center rounded-full text-xs font-bold">
                {negociosPrazoList.length}
              </StatusBadge>
            </div>
            <div className="divide-y divide-border">
              {negociosPrazoList.map((negocio) => (
                <Link
                  key={negocio.id}
                  href="/pipeline"
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/30"
                >
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{negocio.titulo}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{negocio.clientes?.razao_social ?? '—'}</span>
                      {negocio.solucoes && (
                        <>
                          <span>·</span>
                          <span>{negocio.solucoes.nome}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge variant={mapa[negocio.estagio]?.tipo === 'ganho' ? 'fechado_ganho' : mapa[negocio.estagio]?.tipo === 'perdido' ? 'fechado_perdido' : negocio.estagio}>
                      {mapa[negocio.estagio]?.nome ?? negocio.estagio}
                    </StatusBadge>
                    {negocio.data_previsao_fechamento && (
                      <span className="text-xs text-amber-600">
                        {formatDate(negocio.data_previsao_fechamento)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {negociosList.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/8">
              <BarChart3 className="size-7 text-primary/60" />
            </div>
            <p className="text-base font-semibold text-foreground font-[family-name:var(--font-heading)]">
              Pipeline vazio por enquanto
            </p>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Comece adicionando seu primeiro negócio e acompanhe cada etapa do funil.
            </p>
            <Link
              href="/pipeline"
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ir para o Pipeline
            </Link>
          </div>
        )}
      </div>

      {/* ── Visão Executiva ── */}
      {negociosList.length > 0 && (
        <VisaoExecutiva
          pipeline={{
            fatias: fatiasEstagio,
            total: totalFatiasEstagio,
            totalNegocios: totalNegociosPipeline,
          }}
          produtos={{
            fatias: fatiasProduotos,
            total: totalFatiasProdutos,
          }}
          indicadores={topIndicadores}
        />
      )}
    </div>
  )
}
