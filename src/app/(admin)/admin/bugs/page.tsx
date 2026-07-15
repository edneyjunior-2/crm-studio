import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { BugDetailPanel } from './bug-detail-panel'
import { BugsTabs } from './bugs-tabs'
import { RelatoriosSection } from './relatorios-section'

// Exportadas pra reaproveitamento em relatorios-section.tsx (AC5) — evita
// duplicar label/cor num segundo arquivo.
export const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  resolvido: 'Resolvido',
  ignorado: 'Ignorado',
}

export const STATUS_COLORS: Record<string, string> = {
  aberto:     'bg-red-50 text-red-700 border-red-200',
  em_analise: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  resolvido:  'bg-green-50 text-green-700 border-green-200',
  ignorado:   'bg-muted text-muted-foreground border-border',
}

export const SEV_COLORS: Record<string, string> = {
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

type BugReport = {
  id: string
  numero: number
  status: string
  descricao: string
  analise_claude: Record<string, unknown> | null
  screenshot_url: string | null
  user_name: string | null
  user_role: string | null
  url: string | null
  contexto: Record<string, unknown> | null
  created_at: string
}

interface BugsPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function BugsPage({ searchParams }: BugsPageProps) {
  await getAuthPlatformAdmin()
  const admin = createAdminClient()

  const { tab } = await searchParams
  const isHistorico = tab === 'historico'
  const isRelatorios = tab === 'relatorios'

  let bugs: BugReport[] = []
  try {
    bugs = await fetchAllRows<BugReport>((from, to) =>
      admin
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: true })
        .range(from, to)
    )
  } catch {
    bugs = []
  }

  // bucket bug-reports é privado — getPublicUrl nunca funcionou. Registros
  // antigos guardaram a URL pública quebrada, novos guardam só o path.
  // Assina em lote (1h) pras thumbnails da lista.
  const screenshotPaths = bugs
    .filter((b) => b.screenshot_url)
    .map((b) => {
      const raw = b.screenshot_url as string
      const marker = '/bug-reports/'
      const idx = raw.indexOf(marker)
      return idx >= 0 ? raw.slice(idx + marker.length) : raw
    })
  const signedUrlByPath = new Map<string, string>()
  if (screenshotPaths.length > 0) {
    const { data: signedList } = await admin.storage.from('bug-reports').createSignedUrls(screenshotPaths, 3600)
    for (const s of signedList ?? []) {
      if (s.signedUrl) signedUrlByPath.set(s.path ?? '', s.signedUrl)
    }
  }
  function screenshotSignedUrl(rawUrl: string | null): string | null {
    if (!rawUrl) return null
    const marker = '/bug-reports/'
    const idx = rawUrl.indexOf(marker)
    const path = idx >= 0 ? rawUrl.slice(idx + marker.length) : rawUrl
    return signedUrlByPath.get(path) ?? null
  }

  const total = bugs.length
  const abertos = bugs.filter((b) => b.status === 'aberto').length
  const criticos = bugs.filter((b) => (b.analise_claude as Record<string, unknown> | null)?.severidade === 'critica').length

  // Resolvido sai da lista principal (Reports) e vai pro histórico. Se
  // alguém mudar o status de volta (aberto/em_analise/ignorado), a linha
  // volta pra Reports — é só filtrar por status atual, sem flag separada.
  const bugsAtivos = bugs.filter((b) => b.status !== 'resolvido')
  const bugsResolvidos = bugs.filter((b) => b.status === 'resolvido')
  const bugsExibidos = isHistorico ? bugsResolvidos : bugsAtivos

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

      {/* Abas: Reports (ativos) | Histórico de resolvidos | Relatórios */}
      <BugsTabs totalAtivos={bugsAtivos.length} totalResolvidos={bugsResolvidos.length} />

      {/* Relatórios: estatísticas agregadas (RPC única no banco) */}
      {isRelatorios && <RelatoriosSection />}

      {/* Lista */}
      {!isRelatorios && bugsExibidos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-20 text-center text-muted-foreground">
          {isHistorico ? 'Nenhum bug resolvido ainda.' : 'Nenhum bug em aberto. 🎉'}
        </div>
      )}

      {!isRelatorios && bugsExibidos.length > 0 && (
        <div className="flex flex-col gap-2">
          {bugsExibidos.map((bug) => (
            <BugCard key={bug.id} bug={bug} screenshotUrl={screenshotSignedUrl(bug.screenshot_url)} />
          ))}
        </div>
      )}
    </div>
  )
}

function BugCard({ bug, screenshotUrl }: { bug: BugReport; screenshotUrl: string | null }) {
  const analise = bug.analise_claude as Record<string, unknown> | null
  const sev = String(analise?.severidade ?? '')
  const contexto = bug.contexto as Record<string, unknown> | null

  return (
    <a
      href={`/admin/bugs/${bug.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:gap-4"
    >
      {/* Screenshot thumbnail */}
      {screenshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={screenshotUrl}
          alt="Screenshot"
          className="h-16 w-24 shrink-0 rounded-lg border border-border object-cover object-top"
        />
      ) : (
        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          sem foto
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-foreground/70">
            #{String(bug.numero).padStart(3, '0')}
          </span>
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
}
