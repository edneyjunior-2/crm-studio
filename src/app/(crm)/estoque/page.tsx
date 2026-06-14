import { Suspense } from 'react'
import { Package, AlertTriangle, DollarSign, Plus, ArrowRightLeft } from 'lucide-react'
import { getAuthFinanceiro } from '@/lib/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ProdutoForm } from '@/components/crm/estoque/produto-form'
import { MovimentacaoForm } from '@/components/crm/estoque/movimentacao-form'
import { ProdutosTable } from '@/components/crm/estoque/produtos-table'
import { MovimentacoesLista } from '@/components/crm/estoque/movimentacoes-lista'
import type { Produto, MovimentacaoEstoque } from '@/types/estoque'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

async function EstoqueContent() {
  const { supabase } = await getAuthFinanceiro()

  const [{ data: produtos, error: errProdutos }, { data: movimentacoes, error: errMovs }] =
    await Promise.all([
      supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true }),
      supabase
        .from('movimentacoes_estoque')
        .select('*, produtos(id, nome, unidade)')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  if (errProdutos) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-destructive">
          Erro ao carregar produtos: {errProdutos.message}
        </p>
      </div>
    )
  }

  const listaProdutos = (produtos ?? []) as Produto[]
  const listaMovimentacoes = (movimentacoes ?? []) as MovimentacaoEstoque[]

  // KPIs
  const valorTotalEstoque = listaProdutos.reduce(
    (acc, p) => acc + p.saldo_atual * p.custo_medio,
    0
  )
  const itensAbaixoMinimo = listaProdutos.filter(
    (p) => p.estoque_minimo > 0 && p.saldo_atual < p.estoque_minimo
  ).length
  const totalProdutos = listaProdutos.length

  const kpis = [
    {
      label: 'Valor em Estoque',
      value: BRL(valorTotalEstoque),
      icon: DollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Produtos Ativos',
      value: String(totalProdutos),
      icon: Package,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Abaixo do Mínimo',
      value: String(itensAbaixoMinimo),
      icon: AlertTriangle,
      color: itensAbaixoMinimo > 0 ? 'text-amber-600' : 'text-muted-foreground',
      bg: itensAbaixoMinimo > 0 ? 'bg-amber-500/10' : 'bg-muted',
    },
  ]

  const produtosParaMovimentacao = listaProdutos.map((p) => ({
    id: p.id,
    nome: p.nome,
    unidade: p.unidade,
    saldo_atual: p.saldo_atual,
  }))

  return (
    <div className="flex flex-col gap-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${kpi.bg}`}>
                <Icon className={`size-5 ${kpi.color}`} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                <p className={`font-mono text-lg font-semibold ${kpi.color}`}>{kpi.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabela de produtos */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Produtos</h3>
            <p className="text-xs text-muted-foreground">
              {totalProdutos} produto{totalProdutos !== 1 ? 's' : ''} ativo{totalProdutos !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MovimentacaoForm
              produtos={produtosParaMovimentacao}
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ArrowRightLeft className="size-3.5" />
                  Movimentação
                </Button>
              }
            />
            <ProdutoForm
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-3.5" />
                  Novo produto
                </Button>
              }
            />
          </div>
        </div>

        <ProdutosTable produtos={listaProdutos} />
      </div>

      {/* Lista de movimentações recentes */}
      {(errMovs == null) && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Movimentações recentes</h3>
            <p className="text-xs text-muted-foreground">Últimas 50 movimentações registradas.</p>
          </div>
          <MovimentacoesLista movimentacoes={listaMovimentacoes} />
        </div>
      )}
    </div>
  )
}

function EstoqueSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

export default async function EstoquePage() {
  // Auth check: apenas admin e sócio (mesmo padrão do Financeiro)
  await getAuthFinanceiro()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
          Estoque
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Controle de produtos, saldo e movimentações.
        </p>
      </div>

      <Suspense fallback={<EstoqueSkeleton />}>
        <EstoqueContent />
      </Suspense>
    </div>
  )
}
