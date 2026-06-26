import Link from 'next/link'
import { DollarSign, Building2, CheckCircle2, Users, Clock, ArrowRight, HardHat } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_LABELS: Record<string, string> = {
  trial: 'Trial', ativo: 'Ativo', pendente: 'Pendente',
  atrasado: 'Atrasado', suspenso: 'Suspenso', cancelado: 'Cancelado',
}
const STATUS_COLORS: Record<string, string> = {
  trial: 'bg-blue-50 text-blue-700 border-blue-200',
  ativo: 'bg-green-50 text-green-700 border-green-200',
  pendente: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  atrasado: 'bg-orange-50 text-orange-700 border-orange-200',
  suspenso: 'bg-red-50 text-red-700 border-red-200',
  cancelado: 'bg-muted text-muted-foreground border-border',
}
const PLANO_LABELS: Record<string, string> = {
  free: 'Free', trial: 'Trial', interno: 'Interno',
  starter: 'Starter', pro: 'Pro', business: 'Business',
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// Helpers que encapsulam o "agora" (evita Date.now() direto no corpo do componente)
function nowMs(): number {
  return Date.now()
}
function diasRestantes(iso: string, agora: number): number {
  return Math.ceil((new Date(iso).getTime() - agora) / 86_400_000)
}

export default async function AdminDashboardPage() {
  const db = createAdminClient()
  const [
    { data: empresasRaw, error: empresasErr },
    { count: totalUsuarios },
    { count: obrasAtivas },
  ] = await Promise.all([
    db.from('empresas').select('id, nome, plano, status, trial_ends_at, created_at, valor_mensalidade'),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('obras').select('id', { count: 'exact', head: true }).in('status', ['em_andamento', 'orcamento']),
  ])

  // Fallback: coluna valor_mensalidade ainda não existe no banco de produção
  let empresas = empresasRaw
  if (empresasErr && empresasErr.code === '42703') {
    const { data: base } = await db.from('empresas').select('id, nome, plano, status, trial_ends_at, created_at')
    empresas = base as typeof empresas
  }

  const emp = empresas ?? []
  const total = emp.length

  // MRR = soma do valor_mensalidade acordado manualmente nas empresas ativas
  const mrr = emp
    .filter((e) => e.status === 'ativo')
    .reduce((s, e) => s + Number((e as Record<string, unknown>).valor_mensalidade ?? 0), 0)

  const ativas = emp.filter((e) => e.status === 'ativo').length

  const statusCount = Object.keys(STATUS_LABELS).reduce<Record<string, number>>((acc, s) => {
    acc[s] = emp.filter((e) => e.status === s).length
    return acc
  }, {})

  const planoCount = emp.reduce<Record<string, number>>((acc, e) => {
    const p = e.plano ?? 'free'
    acc[p] = (acc[p] ?? 0) + 1
    return acc
  }, {})

  const agoraMs = nowMs()

  // Trials vencendo nos próximos 7 dias (acionável)
  const em7 = agoraMs + 7 * 86_400_000
  const trialsVencendo = emp
    .filter((e) => e.status === 'trial' && e.trial_ends_at && new Date(e.trial_ends_at).getTime() <= em7)
    .sort((a, b) => new Date(a.trial_ends_at!).getTime() - new Date(b.trial_ends_at!).getTime())

  // Cadastros dos últimos 30 dias
  const ha30 = agoraMs - 30 * 86_400_000
  const signupsRecentes = emp
    .filter((e) => new Date(e.created_at).getTime() >= ha30)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral da plataforma · {total} empresa{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="MRR estimado" value={brl(mrr)} hint="mensalidades das ativas" accent />
        <Kpi icon={Building2} label="Empresas" value={String(total)} hint={`${signupsRecentes.length} nos últimos 30d`} />
        <Kpi icon={CheckCircle2} label="Ativas (pagantes)" value={String(ativas)} hint={`${statusCount.trial ?? 0} em trial`} />
        <Kpi icon={Users} label="Usuários" value={String(totalUsuarios ?? 0)} hint="em todas as empresas" />
        <Kpi icon={HardHat} label="Obras ativas" value={String(obrasAtivas ?? 0)} hint="em andamento + orçamento" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trials vencendo — acionável */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="size-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-foreground">Trials vencendo (7 dias)</h2>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {trialsVencendo.length}
            </span>
          </div>
          {trialsVencendo.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum trial vencendo.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {trialsVencendo.map((e) => {
                const dias = diasRestantes(e.trial_ends_at!, agoraMs)
                return (
                  <li key={e.id}>
                    <Link href={`/admin/empresas/${e.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-accent">
                      <span className="truncate text-sm font-medium text-foreground">{e.nome}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${dias <= 1 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        {dias <= 0 ? 'vence hoje' : `${dias} dia${dias > 1 ? 's' : ''}`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Cadastros recentes */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Cadastros recentes (30 dias)</h2>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {signupsRecentes.length}
            </span>
          </div>
          {signupsRecentes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cadastro recente.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {signupsRecentes.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link href={`/admin/empresas/${e.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-accent">
                    <span className="truncate text-sm font-medium text-foreground">{e.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Breakdown por plano */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Por plano</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.keys(PLANO_LABELS).map((p) => (
            <Link key={p} href="/admin/empresas" className="rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent">
              <p className="text-xs font-medium text-muted-foreground">{PLANO_LABELS[p]}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{planoCount[p] ?? 0}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Breakdown por status */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Por status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <Link key={status} href={`/admin/empresas?status=${status}`} className={`rounded-xl border px-4 py-3 transition-opacity hover:opacity-80 ${STATUS_COLORS[status]}`}>
              <p className="text-xs font-medium">{label}</p>
              <p className="mt-1 text-2xl font-bold">{statusCount[status] ?? 0}</p>
            </Link>
          ))}
        </div>
      </section>

      <div>
        <Link href="/admin/empresas" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline">
          Ver todas as empresas <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon, label, value, hint, accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-5 ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${accent ? 'text-emerald-600' : 'text-muted-foreground'}`} />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${accent ? 'text-emerald-700' : 'text-foreground'}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
