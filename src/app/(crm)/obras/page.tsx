import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, HardHat, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

const STATUS_LABEL: Record<string, string> = {
  orcamento:    'Orçamento',
  em_andamento: 'Em andamento',
  pausada:      'Pausada',
  concluida:    'Concluída',
  cancelada:    'Cancelada',
}

const STATUS_CLASS: Record<string, string> = {
  orcamento:    'bg-muted text-muted-foreground',
  em_andamento: 'bg-blue-500/10 text-blue-600',
  pausada:      'bg-yellow-500/10 text-yellow-700',
  concluida:    'bg-green-500/10 text-green-700',
  cancelada:    'bg-red-500/10 text-red-600',
}

const TIPO_LABEL: Record<string, string> = {
  residencial:    'Residencial',
  comercial:      'Comercial',
  industrial:     'Industrial',
  infraestrutura: 'Infraestrutura',
  reforma:        'Reforma',
  outro:          'Outro',
}

function formatarData(data: string | null): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return data
  return `${dia}/${mes}/${ano}`
}

export default async function ObrasPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { tab } = await searchParams
  const tabAtiva = tab === 'concluidas' ? 'concluidas' : tab === 'canceladas' ? 'canceladas' : 'ativas'

  const statusFiltro =
    tabAtiva === 'concluidas'  ? ['concluida'] :
    tabAtiva === 'canceladas'  ? ['cancelada'] :
    ['orcamento', 'em_andamento', 'pausada']

  const [{ data: obras, error }, { data: kpiRaw }] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, tipo, status, valor_contrato, data_previsao_termino, cidade, estado, clientes(razao_social), profiles!responsavel_id(full_name)')
      .in('status', statusFiltro)
      .order('created_at', { ascending: false }),
    supabase
      .from('obras')
      .select('id, status, valor_contrato'),
  ])

  const totalObras      = (kpiRaw ?? []).length
  const emAndamento     = (kpiRaw ?? []).filter((o) => o.status === 'em_andamento').length
  const valorTotal      = (kpiRaw ?? [])
    .filter((o) => o.status === 'em_andamento' && o.valor_contrato)
    .reduce((acc, o) => acc + (o.valor_contrato as number), 0)

  const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
            Obras
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie projetos e contratos de construção civil.
          </p>
        </div>
        <Link
          href="/obras/nova"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Nova obra
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total de obras</span>
          <span className="text-sm font-semibold text-foreground">{totalObras}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/20">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Em andamento</span>
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{emAndamento}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Valor em andamento</span>
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{valorFmt}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        {([
          { key: 'ativas',     label: 'Ativas' },
          { key: 'concluidas', label: 'Concluídas' },
          { key: 'canceladas', label: 'Canceladas' },
        ] as const).map(({ key, label }) => (
          <Link
            key={key}
            href={key === 'ativas' ? '/obras' : `/obras?tab=${key}`}
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
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          Erro ao carregar obras. Tente novamente.
        </div>
      )}

      {!error && (obras ?? []).length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <HardHat className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma obra encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tabAtiva === 'ativas'
                ? 'Cadastre a primeira obra do seu escritório.'
                : 'Nenhuma obra neste status.'}
            </p>
          </div>
          {tabAtiva === 'ativas' && (
            <Link
              href="/obras/nova"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              <Plus className="size-4" />
              Cadastrar obra
            </Link>
          )}
        </div>
      )}

      {!error && (obras ?? []).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(obras ?? []).map((obra) => {
            const clienteRaw = obra.clientes as unknown
            const respRaw    = (obra as Record<string, unknown>)['profiles!responsavel_id'] as unknown
            const clienteNome = (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null
            const respNome    = (respRaw as { full_name?: string } | null)?.full_name ?? null

            return (
              <Link
                key={obra.id}
                href={`/obras/${obra.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground group-hover:text-primary line-clamp-2">
                    {obra.nome}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[obra.status] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {STATUS_LABEL[obra.status] ?? obra.status}
                  </span>
                </div>

                {obra.tipo && (
                  <span className="w-fit rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                    {TIPO_LABEL[obra.tipo] ?? obra.tipo}
                  </span>
                )}

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {clienteNome && (
                    <span className="truncate">Cliente: {clienteNome}</span>
                  )}
                  {(obra.cidade || obra.estado) && (
                    <span className="truncate">
                      {[obra.cidade, obra.estado].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {obra.valor_contrato != null && (
                    <span className="font-medium text-foreground">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.valor_contrato as number)}
                    </span>
                  )}
                  {obra.data_previsao_termino && (
                    <span>Previsão: {formatarData(obra.data_previsao_termino as string)}</span>
                  )}
                  {respNome && (
                    <span className="truncate">Resp.: {respNome}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
