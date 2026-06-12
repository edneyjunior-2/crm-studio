import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RelatorioFiltros } from '@/components/crm/financeiro/relatorio-filtros'
import { RelatorioTabela } from '@/components/crm/financeiro/relatorio-tabela'
import type { ContaReceber, ContaPagar } from '@/types'

export interface RelatorioLinha {
  id: string
  tipo: 'receber' | 'pagar'
  descricao: string
  valor: number
  data_vencimento: string
  status: string
  fornecedor_cliente: string | null
  categoria: string | null
}

interface PageProps {
  searchParams: Promise<{
    tipo?: string
    status?: string
    data_inicio?: string
    data_fim?: string
  }>
}

export default async function RelatorioPage({ searchParams }: PageProps) {
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

  const params = await searchParams
  const tipo = params.tipo ?? 'ambos'
  const status = params.status ?? 'todos'
  const dataInicio = params.data_inicio ?? ''
  const dataFim = params.data_fim ?? ''

  const hasFilter = !!(dataInicio || dataFim || status !== 'todos' || tipo !== 'ambos')

  let linhas: RelatorioLinha[] = []

  if (hasFilter) {
    if (tipo === 'receber' || tipo === 'ambos') {
      let q = supabase
        .from('contas_receber')
        .select('id, descricao, valor, data_vencimento, status, cliente_id, clientes(razao_social)')
        .order('data_vencimento', { ascending: true })

      if (dataInicio) q = q.gte('data_vencimento', dataInicio)
      if (dataFim) q = q.lte('data_vencimento', dataFim)
      if (status !== 'todos') q = q.eq('status', status === 'pago' ? 'recebido' : status)

      const { data } = await q
      const rows = (data ?? []) as unknown as (ContaReceber & { clientes: { razao_social: string } | null })[]

      linhas.push(
        ...rows.map((r) => ({
          id: r.id,
          tipo: 'receber' as const,
          descricao: r.descricao,
          valor: Number(r.valor),
          data_vencimento: r.data_vencimento,
          status: r.status,
          fornecedor_cliente: r.clientes?.razao_social ?? null,
          categoria: null,
        }))
      )
    }

    if (tipo === 'pagar' || tipo === 'ambos') {
      let q = supabase
        .from('contas_pagar')
        .select('id, descricao, valor, data_vencimento, status, fornecedor, categoria')
        .order('data_vencimento', { ascending: true })

      if (dataInicio) q = q.gte('data_vencimento', dataInicio)
      if (dataFim) q = q.lte('data_vencimento', dataFim)
      if (status !== 'todos') q = q.eq('status', status === 'recebido' ? 'pago' : status)

      const { data } = await q
      const rows = (data ?? []) as ContaPagar[]

      linhas.push(
        ...rows.map((r) => ({
          id: r.id,
          tipo: 'pagar' as const,
          descricao: r.descricao,
          valor: Number(r.valor),
          data_vencimento: r.data_vencimento,
          status: r.status,
          fornecedor_cliente: r.fornecedor ?? null,
          categoria: r.categoria ?? null,
        }))
      )
    }

    linhas.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Relatório Financeiro</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Filtre e exporte extratos de contas a receber e a pagar.
        </p>
      </div>

      <RelatorioFiltros
        tipo={tipo}
        status={status}
        dataInicio={dataInicio}
        dataFim={dataFim}
      />

      {hasFilter ? (
        <RelatorioTabela linhas={linhas} filtros={{ tipo, status, dataInicio, dataFim }} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Selecione os filtros acima e clique em &quot;Gerar Relatório&quot; para visualizar os dados.
          </p>
        </div>
      )}
    </div>
  )
}
