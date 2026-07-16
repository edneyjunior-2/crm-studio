import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

const STATUS_LABEL: Record<string, string> = {
  rascunho:  'Rascunho',
  enviada:   'Enviada',
  aprovada:  'Aprovada',
  em_viagem: 'Em viagem',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<string, string> = {
  rascunho:  'bg-muted text-muted-foreground',
  enviada:   'bg-blue-500/10 text-blue-600',
  aprovada:  'bg-emerald-500/10 text-emerald-700',
  em_viagem: 'bg-amber-500/10 text-amber-700',
  concluida: 'bg-green-500/10 text-green-700',
  cancelada: 'bg-red-500/10 text-red-600',
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_ABERTOS = ['rascunho', 'enviada', 'aprovada', 'em_viagem']

export default async function FretePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { tab } = await searchParams
  const tabAtiva = tab === 'concluidas' ? 'concluidas' : tab === 'canceladas' ? 'canceladas' : 'abertas'

  const statusFiltro =
    tabAtiva === 'concluidas' ? ['concluida'] :
    tabAtiva === 'canceladas' ? ['cancelada'] :
    STATUS_ABERTOS

  // Início/fim do mês corrente em data local — nunca .toISOString() (CLAUDE.md).
  const hoje       = new Date()
  const inicioMes  = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  const fimMes     = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: cotacoes, error },
    { count: veiculosAtivos },
    { count: motoristasAtivos },
    { count: cotacoesAbertas },
    cotacoesDoMes,
  ] = await Promise.all([
    supabase
      .from('frete_cotacoes')
      .select('id, origem, destino, status, valor_negociado, valor_piso_antt, tabela_antt, created_at, clientes(razao_social)')
      .in('status', statusFiltro)
      .order('created_at', { ascending: false }),
    supabase.from('frete_veiculos').select('id', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('frete_motoristas').select('id', { count: 'exact', head: true }).eq('ativo', true),
    supabase.from('frete_cotacoes').select('id', { count: 'exact', head: true }).in('status', STATUS_ABERTOS),
    // fetchAllRows contorna o cap de 1000 do PostgREST — soma precisa dos valores, não só contagem.
    fetchAllRows<{ valor_negociado: number | null }>((from, to) =>
      supabase
        .from('frete_cotacoes')
        .select('valor_negociado')
        .gte('created_at', inicioMes)
        .lt('created_at', fimMes)
        .range(from, to),
    ),
  ])

  const valorMes = cotacoesDoMes.reduce((acc, c) => acc + (c.valor_negociado ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
            Frete e Logística
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cotações, veículos e motoristas da operação de frete.
          </p>
        </div>
        <Link
          href="/frete/cotacoes/nova"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Nova cotação
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Veículos ativos</span>
          <span className="text-sm font-semibold text-foreground">{veiculosAtivos ?? 0}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Motoristas ativos</span>
          <span className="text-sm font-semibold text-foreground">{motoristasAtivos ?? 0}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/20">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cotações em aberto</span>
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{cotacoesAbertas ?? 0}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Negociado no mês</span>
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{BRL.format(valorMes)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        {([
          { key: 'abertas',    label: 'Em aberto' },
          { key: 'concluidas', label: 'Concluídas' },
          { key: 'canceladas', label: 'Canceladas' },
        ] as const).map(({ key, label }) => (
          <Link
            key={key}
            href={key === 'abertas' ? '/frete' : `/frete?tab=${key}`}
            className={
              tabAtiva === key
                ? 'rounded-md bg-background px-4 py-1.5 text-sm font-medium shadow-sm text-foreground'
                : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Erro ao carregar cotações: {error.message}
        </div>
      )}

      {(cotacoes ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <Truck className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma cotação encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tabAtiva === 'abertas'
                ? 'Nenhuma cotação em aberto no momento. Crie a primeira cotação de frete.'
                : 'Nenhuma cotação neste status.'}
            </p>
          </div>
          {tabAtiva === 'abertas' && (
            <Link
              href="/frete/cotacoes/nova"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              <Plus className="size-4" />
              Nova cotação
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Rota</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Cliente</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Tabela ANTT</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(cotacoes ?? []).map((c) => {
                const clienteRaw  = c.clientes as unknown
                const clienteNome = (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null
                const valor       = (c.valor_negociado as number | null) ?? (c.valor_piso_antt as number | null)
                return (
                  <tr key={c.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/frete/cotacoes/${c.id}`} className="font-medium text-foreground hover:underline">
                        {c.origem} → {c.destino}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{clienteNome ?? '—'}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{c.tabela_antt}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{valor != null ? BRL.format(valor) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[c.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
