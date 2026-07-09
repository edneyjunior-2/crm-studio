import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bug, Clock, Monitor, User, Building2, ExternalLink } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { AcceptButton } from './accept-button'
import { ReanalisarButton } from './reanalisar-button'
import { BugDetailPanel } from '../bug-detail-panel'

const SEV_COLORS: Record<string, string> = {
  critica: 'bg-red-100 text-red-700 border-red-300',
  alta:    'bg-orange-100 text-orange-700 border-orange-300',
  media:   'bg-yellow-100 text-yellow-700 border-yellow-300',
  baixa:   'bg-green-100 text-green-700 border-green-300',
}
const SEV_LABELS: Record<string, string> = {
  critica: '🔴 Crítica', alta: '🟠 Alta', media: '🟡 Média', baixa: '🟢 Baixa',
}
const CAT_LABELS: Record<string, string> = {
  interface: 'Interface', dados: 'Dados', autenticacao: 'Autenticação',
  performance: 'Performance', email: 'E-mail', integracao: 'Integração', outro: 'Outro',
}

export default async function BugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await getAuthPlatformAdmin()
  const { id } = await params
  const admin = createAdminClient()

  const { data: bug } = await admin
    .from('bug_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!bug) notFound()

  // bucket bug-reports é privado — getPublicUrl nunca funcionou ("Bucket not
  // found" silencioso). Registros antigos guardaram essa URL quebrada; novos
  // guardam só o path. Tolerante aos dois: extrai o path pelo marker se for
  // URL, usa direto se já for path, e assina pra exibir por 1h.
  let screenshotSignedUrl: string | null = null
  if (bug.screenshot_url) {
    const raw = bug.screenshot_url as string
    const marker = '/bug-reports/'
    const idx = raw.indexOf(marker)
    const path = idx >= 0 ? raw.slice(idx + marker.length) : raw
    const { data: signed } = await admin.storage.from('bug-reports').createSignedUrl(path, 3600)
    screenshotSignedUrl = signed?.signedUrl ?? null
  }

  const analise = bug.analise_claude as Record<string, unknown> | null
  const contexto = bug.contexto as Record<string, unknown> | null
  const sev = String(analise?.severidade ?? '')
  const cat = String(analise?.categoria ?? '')
  const promptCorrecao = String(analise?.prompt_correcao ?? '')
  const proximosPassos = (analise?.proximos_passos as string[] | undefined) ?? []

  const createdAt = new Date(String(bug.created_at))
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(createdAt)

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/admin/bugs" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
          Bug Reports
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-xs text-muted-foreground">{id.slice(0, 8)}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-red-50 border border-red-100">
            <Bug className="size-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-snug">
              {String(analise?.titulo_curto ?? bug.descricao).slice(0, 80)}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{dataFormatada}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sev && (
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEV_COLORS[sev] ?? 'bg-muted border-border text-muted-foreground'}`}>
              {SEV_LABELS[sev] ?? sev}
            </span>
          )}
          {cat && (
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              {CAT_LABELS[cat] ?? cat}
            </span>
          )}
          <BugDetailPanel bugId={id} currentStatus={String(bug.status)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Coluna principal */}
        <div className="flex flex-col gap-4">

          {/* Screenshot */}
          {screenshotSignedUrl && (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">Screenshot</span>
                <a href={screenshotSignedUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3" /> Abrir original
                </a>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshotSignedUrl} alt="Screenshot" className="w-full object-cover object-top" />
            </div>
          )}

          {/* Descrição do usuário */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição do usuário</p>
            <p className="text-sm leading-relaxed">{bug.descricao}</p>
          </div>

          {/* Análise do Claude */}
          {analise && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Análise do Claude</p>
              <div className="flex flex-col gap-3 text-sm">
                {!!analise.causa_provavel && (
                  <div>
                    <p className="font-medium text-foreground/70">Causa provável</p>
                    <p className="mt-0.5 text-muted-foreground">{String(analise.causa_provavel)}</p>
                  </div>
                )}
                {!!analise.sugestao_correcao && (
                  <div>
                    <p className="font-medium text-foreground/70">Sugestão de correção</p>
                    <p className="mt-0.5 text-muted-foreground">{String(analise.sugestao_correcao)}</p>
                  </div>
                )}
                {proximosPassos.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground/70">Próximos passos</p>
                    <ol className="mt-1.5 flex flex-col gap-1">
                      {proximosPassos.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-muted-foreground">
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
                            {i + 1}
                          </span>
                          {p}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt para o agente */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Prompt para o agente
              </p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                Claude Code
              </span>
            </div>
            {promptCorrecao ? (
              <pre className="whitespace-pre-wrap rounded-lg bg-white border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 p-4 font-mono text-xs leading-relaxed text-foreground">
                {promptCorrecao}
              </pre>
            ) : (
              <>
                <p className="text-sm text-muted-foreground italic">
                  Prompt ainda não gerado — o bug foi registrado antes da análise completar.
                </p>
                <ReanalisarButton bugId={id} />
              </>
            )}

            {/* Botões de ação */}
            <AcceptButton
              bugId={id}
              currentStatus={String(bug.status)}
              prompt={promptCorrecao}
              hasPrompt={!!promptCorrecao}
            />
          </div>
        </div>

        {/* Sidebar de contexto */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contexto</p>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{bug.user_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{bug.user_role ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{String(contexto?.empresa_nome ?? '—')}</p>
                  <p className="text-xs text-muted-foreground">Empresa</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Monitor className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-mono text-xs">{String(bug.url ?? '').replace('https://app.crmstudio.com.br', '') || '/'}</p>
                  <p className="text-xs text-muted-foreground">{String(contexto?.viewport ?? '—')}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{dataFormatada}</p>
                  <p className="text-xs text-muted-foreground">Reportado em</p>
                </div>
              </div>
            </div>
          </div>

          {/* User agent */}
          {!!contexto?.user_agent && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Navegador</p>
              <p className="break-all font-mono text-[10px] text-muted-foreground leading-relaxed">
                {String(contexto.user_agent).slice(0, 200)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
