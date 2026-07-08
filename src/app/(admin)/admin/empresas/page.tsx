import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Plus } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  pendente_cartao: 'bg-amber-50 text-amber-700',
  trial:     'bg-blue-50 text-blue-700',
  ativo:     'bg-green-50 text-green-700',
  pendente:  'bg-yellow-50 text-yellow-700',
  atrasado:  'bg-orange-50 text-orange-700',
  suspenso:  'bg-red-50 text-red-700',
  cancelado: 'bg-muted text-muted-foreground',
}

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status: filtroStatus, q: busca } = await searchParams

  const db = createAdminClient()
  let query = db
    .from('empresas')
    .select('id, nome, plano, status, trial_ends_at, created_at, primeiro_acesso_em, valor_mensalidade')
    .order('created_at', { ascending: false })

  if (filtroStatus) query = query.eq('status', filtroStatus)
  if (busca) query = query.ilike('nome', `%${busca}%`)

  const { data: empresasData, error: qErr } = await query
  let empresas = empresasData

  // Colunas novas ainda não existem no banco de produção → fallback sem elas
  if (qErr && qErr.code === '42703') {
    let fallback = db
      .from('empresas')
      .select('id, nome, plano, status, trial_ends_at, created_at')
      .order('created_at', { ascending: false })
    if (filtroStatus) fallback = fallback.eq('status', filtroStatus)
    if (busca) fallback = fallback.ilike('nome', `%${busca}%`)
    const { data: base } = await fallback
    empresas = base as typeof empresas
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empresas?.length ?? 0} resultado{empresas?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin/empresas/new"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Nova empresa
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {['', 'pendente_cartao', 'trial', 'ativo', 'suspenso', 'cancelado'].map((s) => (
          <Link
            key={s || 'todos'}
            href={s ? `/admin/empresas?status=${s}` : '/admin/empresas'}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filtroStatus === s || (!filtroStatus && !s)
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
            }`}
          >
            {s || 'Todos'}
          </Link>
        ))}
      </div>

      {/* Tabela */}
      {!empresas?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
          <Link
            href="/admin/empresas/new"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            <Plus className="size-3.5" /> Criar primeira empresa
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plano</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mensalidade</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">1º acesso</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/empresas/${e.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {e.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{e.plano}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[e.status] ?? 'bg-muted text-muted-foreground'}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {(e as Record<string, unknown>).valor_mensalidade
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number((e as Record<string, unknown>).valor_mensalidade))
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {(e as Record<string, unknown>).primeiro_acesso_em ? (
                      <span className="text-xs text-muted-foreground">
                        {new Date((e as Record<string, unknown>).primeiro_acesso_em as string).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                        Aguardando acesso
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
