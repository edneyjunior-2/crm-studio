import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { TrendingUp, TrendingDown, Wallet, Landmark, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { FluxoCaixaChart } from '@/components/crm/financeiro/fluxo-caixa-chart'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatDate(date: string) {
  const [y, m, d] = date.split('-')
  return new Date(+y, +m - 1, +d).toLocaleDateString('pt-BR')
}

interface VencendoItem {
  id: string
  descricao: string
  valor: number
  data_vencimento: string
  tipo: 'receber' | 'pagar'
}

interface MesFluxo {
  mes: string
  entradas: number
  saidas: number
}

async function DashboardContent() {
  const supabase = await createClient()

  const now = new Date()
  const mesAtual = now.getMonth() + 1
  const anoAtual = now.getFullYear()
  const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`
  const ultimoDia = new Date(anoAtual, mesAtual, 0).getDate()
  const fimMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  const seteD = new Date(now)
  seteD.setDate(seteD.getDate() + 7)
  const hoje = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const limite7d = `${seteD.getFullYear()}-${String(seteD.getMonth() + 1).padStart(2, '0')}-${String(seteD.getDate()).padStart(2, '0')}`

  const [
    { data: bancos },
    { data: movimentacoes },
    { data: receberMes },
    { data: pagarMes },
    { data: vencendoReceber },
    { data: vencendoPagar },
    { data: movimentacoes6m },
  ] = await Promise.all([
    supabase.from('bancos').select('saldo_inicial').eq('ativo', true),
    supabase.from('movimentacoes').select('tipo, valor'),
    supabase
      .from('contas_receber')
      .select('valor')
      .eq('status', 'pendente')
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMes),
    supabase
      .from('contas_pagar')
      .select('valor')
      .eq('status', 'pendente')
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMes),
    supabase
      .from('contas_receber')
      .select('id, descricao, valor, data_vencimento')
      .in('status', ['pendente', 'atrasado'])
      .gte('data_vencimento', hoje)
      .lte('data_vencimento', limite7d)
      .order('data_vencimento', { ascending: true })
      .limit(5),
    supabase
      .from('contas_pagar')
      .select('id, descricao, valor, data_vencimento')
      .in('status', ['pendente', 'atrasado'])
      .gte('data_vencimento', hoje)
      .lte('data_vencimento', limite7d)
      .order('data_vencimento', { ascending: true })
      .limit(5),
    supabase
      .from('movimentacoes')
      .select('tipo, valor, data')
      .gte('data', (() => {
        const d = new Date(now)
        d.setMonth(d.getMonth() - 5)
        d.setDate(1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      })())
      .order('data', { ascending: true }),
  ])

  const saldoInicial = (bancos ?? []).reduce((s, b) => s + Number(b.saldo_inicial), 0)
  const totalEntradas = (movimentacoes ?? [])
    .filter((m) => m.tipo === 'entrada')
    .reduce((s, m) => s + Number(m.valor), 0)
  const totalSaidas = (movimentacoes ?? [])
    .filter((m) => m.tipo === 'saida')
    .reduce((s, m) => s + Number(m.valor), 0)
  const saldoCaixa = saldoInicial + totalEntradas - totalSaidas

  const aReceberMes = (receberMes ?? []).reduce((s, c) => s + Number(c.valor), 0)
  const aPagarMes = (pagarMes ?? []).reduce((s, c) => s + Number(c.valor), 0)
  const resultadoPrevisto = aReceberMes - aPagarMes

  const vencendoList: VencendoItem[] = [
    ...(vencendoReceber ?? []).map((c) => ({
      ...c,
      tipo: 'receber' as const,
    })),
    ...(vencendoPagar ?? []).map((c) => ({
      ...c,
      tipo: 'pagar' as const,
    })),
  ]
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
    .slice(0, 5)

  const mesesFluxo: MesFluxo[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const ano = d.getFullYear()
    const mes = d.getMonth() + 1
    const chave = `${ano}-${String(mes).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

    const movs = (movimentacoes6m ?? []).filter((m) => m.data.startsWith(chave))
    const entradas = movs.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0)
    const saidas = movs.filter((m) => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0)
    mesesFluxo.push({ mes: label, entradas, saidas })
  }

  const kpiCards = [
    {
      label: 'Saldo em Caixa',
      value: saldoCaixa,
      icon: Landmark,
      color: saldoCaixa >= 0 ? 'text-blue-600' : 'text-orange-600',
      bg: saldoCaixa >= 0 ? 'bg-blue-500/10' : 'bg-orange-500/10',
    },
    {
      label: 'A Receber este mês',
      value: aReceberMes,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'A Pagar este mês',
      value: aPagarMes,
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Resultado Previsto',
      value: resultadoPrevisto,
      icon: Wallet,
      color: resultadoPrevisto >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: resultadoPrevisto >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${card.bg}`}>
                <Icon className={`size-5 ${card.color}`} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                <p className={`font-mono text-lg font-semibold ${card.color}`}>
                  {BRL(card.value)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Fluxo de Caixa — últimos 6 meses
          </h3>
          <FluxoCaixaChart dados={mesesFluxo} />
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">
              Vencendo nos próximos 7 dias
            </h3>
          </div>

          {vencendoList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma conta vencendo nos próximos 7 dias.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {vencendoList.map((item) => (
                <div
                  key={`${item.tipo}-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex size-2 shrink-0 rounded-full ${item.tipo === 'receber' ? 'bg-emerald-500' : 'bg-red-500'}`}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.descricao}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.data_vencimento)} &middot;{' '}
                        {item.tipo === 'receber' ? 'Receber' : 'Pagar'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-semibold ${item.tipo === 'receber' ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    {BRL(item.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="lg:col-span-3 h-64 rounded-xl" />
        <Skeleton className="lg:col-span-2 h-64 rounded-xl" />
      </div>
    </div>
  )
}

export default async function DashboardFinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'socio'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Dashboard Financeiro</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão consolidada de caixa, receitas e despesas.
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
