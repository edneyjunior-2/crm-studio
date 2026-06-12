import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, TrendingUp, TrendingDown, Wallet, LayoutDashboard, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ContasReceberTable } from '@/components/crm/financeiro/contas-receber-table'
import { ContasPagarTable } from '@/components/crm/financeiro/contas-pagar-table'
import { ContaReceberForm } from '@/components/crm/financeiro/conta-receber-form'
import { ContaPagarForm } from '@/components/crm/financeiro/conta-pagar-form'
import { ComissaoForm } from '@/components/crm/financeiro/comissao-form'
import { ComissoesAdminTable } from '@/components/crm/financeiro/comissoes-admin-table'
import { FornecedorForm } from '@/components/crm/financeiro/fornecedor-form'
import { FornecedoresTable } from '@/components/crm/financeiro/fornecedores-table'
import { ParceiroComissaoForm } from '@/components/crm/financeiro/parceiro-comissao-form'
import { ParceirosComissaoTable } from '@/components/crm/financeiro/parceiros-comissao-table'
import { AlertasVencimento } from '@/components/crm/financeiro/alertas-vencimento'
import { PendenciasFinanceiras } from '@/components/crm/financeiro/pendencias-financeiras'
import type { ContaReceber, ContaPagar, Cliente, Negocio, ComissaoComRelacoes, Fornecedor, Moeda, Banco, Movimentacao, ParceiroComissao } from '@/types'
import { formatMoeda } from '@/lib/moedas'

function groupByMoeda(items: { valor: number; moeda: Moeda }[]) {
  const map = new Map<Moeda, number>()
  for (const item of items) {
    map.set(item.moeda, (map.get(item.moeda) ?? 0) + Number(item.valor))
  }
  return map
}

function KpiValue({ map, colorClass }: { map: Map<Moeda, number>; colorClass: string }) {
  const entries = [...map.entries()].filter(([, v]) => v !== 0)
  if (entries.length === 0) {
    return <p className={`font-mono text-lg font-semibold ${colorClass}`}>{formatMoeda(0)}</p>
  }
  return (
    <div className="flex flex-col gap-0">
      {entries.map(([moeda, valor]) => (
        <p key={moeda} className={`font-mono text-lg font-semibold leading-tight ${colorClass}`}>
          {formatMoeda(valor, moeda)}
        </p>
      ))}
    </div>
  )
}

interface ContaReceberComRelacoes extends ContaReceber {
  clientes: { razao_social: string } | null
}

async function FinanceiroContent() {
  const supabase = await createClient()

  const [
    { data: contasReceber, error: errReceber },
    { data: contasPagar, error: errPagar },
    { data: clientes },
    { data: negocios },
    { data: comissoes },
    { data: comerciais },
    { data: bancosData },
    { data: movsData },
    { data: fornecedoresData },
    { data: parceirosData },
  ] = await Promise.all([
    supabase
      .from('contas_receber')
      .select('*, clientes(razao_social)')
      .order('data_vencimento', { ascending: true }),
    supabase
      .from('contas_pagar')
      .select('*')
      .order('data_vencimento', { ascending: true }),
    supabase
      .from('clientes')
      .select('id, razao_social')
      .order('razao_social', { ascending: true }),
    supabase
      .from('negocios')
      .select('id, titulo')
      .order('titulo', { ascending: true }),
    supabase
      .from('comissoes_comercial')
      .select('*, profiles!comercial_id(full_name), negocios(titulo), parceiros_comissao(nome)')
      .order('data_previsao', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'comercial')
      .order('full_name', { ascending: true }),
    supabase
      .from('bancos')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    // PERFORMANCE: o saldo de cada banco é calculado como saldo_inicial + soma de
    // TODAS as movimentações históricas (entradas - saídas). Um filtro temporal
    // quebraria o cálculo se houver movimentações antigas ainda relevantes para o
    // saldo atual. O limite de 500 registros é uma proteção imediata contra tabelas
    // muito grandes. A solução definitiva é adicionar uma coluna `saldo_atual` na
    // tabela `bancos`, atualizada por trigger a cada INSERT/UPDATE/DELETE em
    // `movimentacoes`, eliminando completamente a necessidade desta query agregada.
    supabase
      .from('movimentacoes')
      .select('banco_id, tipo, valor')
      .limit(500),
    supabase
      .from('fornecedores')
      .select('*')
      .order('nome', { ascending: true }),
    supabase
      .from('parceiros_comissao')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true }),
  ])

  if (errReceber || errPagar) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive">
          Erro ao carregar dados financeiros. Tente novamente mais tarde.
        </p>
      </div>
    )
  }

  const receberList = (contasReceber ?? []) as ContaReceberComRelacoes[]
  const pagarList = (contasPagar ?? []) as ContaPagar[]
  const clientesList = (clientes ?? []) as Pick<Cliente, 'id' | 'razao_social'>[]
  const negociosList = (negocios ?? []) as Pick<Negocio, 'id' | 'titulo'>[]
  const comissoesList = (comissoes ?? []) as ComissaoComRelacoes[]
  const comerciaisList = (comerciais ?? []) as { id: string; full_name: string }[]

  const fornecedoresList = (fornecedoresData ?? []) as Fornecedor[]
  const parceirosComissaoList = (parceirosData ?? []) as ParceiroComissao[]

  const bancos = (bancosData ?? []) as Banco[]
  const movimentacoes = (movsData ?? []) as Pick<Movimentacao, 'banco_id' | 'tipo' | 'valor'>[]
  const bancosComSaldo = bancos.map((b) => {
    const movs = movimentacoes.filter((m) => m.banco_id === b.id)
    const entradas = movs.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0)
    const saidas = movs.filter((m) => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0)
    return { ...b, saldo: Number(b.saldo_inicial) + entradas - saidas }
  })

  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()

  function isMesAtual(dataVencimento: string) {
    const [y, m] = dataVencimento.split('-').map(Number)
    return m - 1 === mesAtual && y === anoAtual
  }

  const hojeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const contasVencendoHoje = pagarList.filter(
    (c) => c.data_vencimento === hojeStr && c.status === 'pendente'
  )
  const contasAtrasadas = pagarList.filter(
    (c) => c.data_vencimento < hojeStr && (c.status === 'pendente' || c.status === 'atrasado')
  )
  const contasAlerta = [...contasAtrasadas, ...contasVencendoHoje]

  // Pendencias: atrasadas (qualquer data) + pendentes vencendo nos próximos 30 dias
  const em30Dias = new Date(now)
  em30Dias.setDate(now.getDate() + 30)
  const em30DiasStr = `${em30Dias.getFullYear()}-${String(em30Dias.getMonth() + 1).padStart(2, '0')}-${String(em30Dias.getDate()).padStart(2, '0')}`
  const pendencias = pagarList
    .filter((c) =>
      c.status === 'atrasado' ||
      (c.status === 'pendente' && c.data_vencimento <= em30DiasStr)
    )
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))

  const receberPendentes = receberList.filter((c) => c.status === 'pendente' || c.status === 'atrasado')
  const pagarPendentes = pagarList.filter(
    (c) => (c.status === 'pendente' || c.status === 'atrasado') && isMesAtual(c.data_vencimento)
  )

  const totalAReceberMap = groupByMoeda(receberPendentes)
  const totalAPagarMap = groupByMoeda(pagarPendentes)

  const allMoedas = new Set([...totalAReceberMap.keys(), ...totalAPagarMap.keys()])
  const saldoPrevMap = new Map<Moeda, number>()
  for (const moeda of allMoedas) {
    saldoPrevMap.set(moeda, (totalAReceberMap.get(moeda) ?? 0) - (totalAPagarMap.get(moeda) ?? 0))
  }

  const totalComissoesPrevistos = comissoesList
    .filter((c) => c.status === 'previsto')
    .reduce((sum, c) => sum + Number(c.valor), 0)

  return (
    <div className="flex flex-col gap-6">
      <AlertasVencimento contas={contasAlerta} bancos={bancosComSaldo} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="size-5 text-emerald-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">A Receber</p>
            <KpiValue map={totalAReceberMap} colorClass="text-emerald-600" />
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
            <TrendingDown className="size-5 text-red-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">A Pagar este mês</p>
            <KpiValue map={totalAPagarMap} colorClass="text-red-600" />
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${[...saldoPrevMap.values()].every((v) => v >= 0) ? 'bg-blue-500/10' : 'bg-orange-500/10'}`}>
            <Wallet className={`size-5 ${[...saldoPrevMap.values()].every((v) => v >= 0) ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">Saldo do mês</p>
            <KpiValue
              map={saldoPrevMap}
              colorClass={[...saldoPrevMap.values()].every((v) => v >= 0) ? 'text-blue-600' : 'text-orange-600'}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="pagar">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pagar">Contas a Pagar</TabsTrigger>
            <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
            <TabsTrigger value="comissoes">
              Comissões
              {totalComissoesPrevistos > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-medium text-amber-700">
                  {comissoesList.filter((c) => c.status === 'previsto').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
            <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
          </TabsList>

          <div>
            <TabsContent value="pagar">
              <ContaPagarForm
                fornecedores={fornecedoresList}
                sugestoes={pagarList}
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Nova Conta
                  </Button>
                }
              />
            </TabsContent>
            <TabsContent value="receber">
              <ContaReceberForm
                clientes={clientesList}
                negocios={negociosList}
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Nova Conta
                  </Button>
                }
              />
            </TabsContent>
            <TabsContent value="comissoes">
              <ComissaoForm
                comerciais={comerciaisList}
                negocios={negociosList}
                parceiros={parceirosComissaoList}
              />
            </TabsContent>
            <TabsContent value="fornecedores">
              <FornecedorForm
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Novo Fornecedor
                  </Button>
                }
              />
            </TabsContent>
            <TabsContent value="parceiros">
              <ParceiroComissaoForm
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Novo Parceiro
                  </Button>
                }
              />
            </TabsContent>
          </div>
        </div>

        <TabsContent value="receber">
          <ContasReceberTable
            contas={receberList}
            clientes={clientesList}
            negocios={negociosList}
            bancos={bancosComSaldo}
          />
        </TabsContent>

        <TabsContent value="pagar">
          <PendenciasFinanceiras contas={pendencias} bancos={bancosComSaldo} fornecedores={fornecedoresList} />
          <ContasPagarTable contas={pagarList} bancos={bancosComSaldo} />
        </TabsContent>

        <TabsContent value="comissoes">
          <ComissoesAdminTable comissoes={comissoesList} />
        </TabsContent>

        <TabsContent value="fornecedores">
          <FornecedoresTable fornecedores={fornecedoresList} />
        </TabsContent>

        <TabsContent value="parceiros">
          <ParceirosComissaoTable parceiros={parceirosComissaoList} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FinanceiroSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-80" />
        <div className="rounded-xl border border-border bg-card p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-2 py-3 last:border-0">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Comercial acessa a visão de comissões pessoais
  if (profile.role === 'comercial') redirect('/financeiro/comissoes')

  // Qualquer outro role sem permissão vai pro dashboard
  if (!['admin', 'socio'].includes(profile.role)) redirect('/dashboard')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Financeiro</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie contas a receber, a pagar e comissões da equipe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/financeiro/dashboard" />}
          >
            <LayoutDashboard className="size-3.5" />
            Dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/financeiro/relatorio" />}
          >
            <FileText className="size-3.5" />
            Relatório
          </Button>
        </div>
      </div>

      <Suspense fallback={<FinanceiroSkeleton />}>
        <FinanceiroContent />
      </Suspense>
    </div>
  )
}
