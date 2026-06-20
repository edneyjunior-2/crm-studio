import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { BugDetailPanel } from './bug-detail-panel'

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  resolvido: 'Resolvido',
  ignorado: 'Ignorado',
}

const STATUS_COLORS: Record<string, string> = {
  aberto:     'bg-red-50 text-red-700 border-red-200',
  em_analise: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  resolvido:  'bg-green-50 text-green-700 border-green-200',
  ignorado:   'bg-muted text-muted-foreground border-border',
}

const SEV_COLORS: Record<string, string> = {
  critica: 'bg-red-500 text-white',
  alta:    'bg-orange-400 text-white',
  media:   'bg-yellow-400 text-foreground',
  baixa:   'bg-green-400 text-white',
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60)    return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24)    return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

export default async function BugsPage() {
  await getAuthPlatformAdmin()
  const admin = createAdminClient()

  const { data: bugs } = await admin
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const total = bugs?.length ?? 0
  const abertos = bugs?.filter((b) => b.status === 'aberto').length ?? 0
  const criticos = bugs?.filter((b) => b.analise_claude?.severidade === 'critica').length ?? 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios de bug</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Problemas reportados pelos usuários · analisados pelo Claude
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de reports', value: total },
          { label: 'Em aberto', value: abertos, highlight: abertos > 0 },
          { label: 'Críticos', value: criticos, danger: criticos > 0 },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${m.danger ? 'text-red-600' : m.highlight ? 'text-amber-600' : ''}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {(!bugs || bugs.length === 0) && (
        <div className="rounded-xl border border-dashed border-border py-20 text-center text-muted-foreground">
          Nenhum bug reportado ainda.
        </div>
      )}

      {bugs && bugs.length > 0 && (
        <div className="flex flex-col gap-2">
          {bugs.map((bug) => {
            const analise = bug.analise_claude as Record<string, unknown> | null
            const sev = String(analise?.severidade ?? '')
            const contexto = bug.contexto as Record<string, unknown> | null
            return (
              <a
                key={bug.id}
                href={`/admin/bugs/${bug.id}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:gap-4"
              >
                {/* Screenshot thumbnail */}
                {bug.screenshot_url ? (
                  <a href={bug.screenshot_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bug.screenshot_url}
                      alt="Screenshot"
                      className="h-16 w-24 rounded-lg border border-border object-cover object-top"
                    />
                  </a>
                ) : (
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    sem foto
                  </div>
                )}

                {/* Conteúdo */}
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {sev && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SEV_COLORS[sev] ?? 'bg-muted'}`}>
                        {sev}
                      </span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[bug.status] ?? ''}`}>
                      {STATUS_LABELS[bug.status] ?? bug.status}
                    </span>
                    {!!analise?.categoria && (
                      <span className="text-[11px] text-muted-foreground">#{String(analise.categoria)}</span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">{relTime(String(bug.created_at))}</span>
                  </div>

                  <p className="font-semibold leading-snug">
                    {String(analise?.titulo_curto ?? bug.descricao).slice(0, 90)}
                  </p>

                  <p className="text-sm text-muted-foreground line-clamp-2">{bug.descricao}</p>

                  <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                    <span>{bug.user_name ?? '?'} · {bug.user_role}</span>
                    <span>{contexto?.empresa_nome as string ?? '?'}</span>
                    <code className="font-mono">{String(bug.url ?? '').replace('https://app.crmstudio.com.br', '')}</code>
                  </div>

                  {!!analise?.causa_provavel && (
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground/70">Causa provável:</span>{' '}
                      {String(analise.causa_provavel)}
                    </p>
                  )}

                  {!!analise?.sugestao_correcao && (
                    <p className="text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground/70">Sugestão:</span>{' '}
                      {String(analise.sugestao_correcao)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <BugDetailPanel bugId={bug.id} currentStatus={bug.status} />
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
