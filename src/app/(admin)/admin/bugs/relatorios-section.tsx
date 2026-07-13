import { createAdminClient } from '@/lib/supabase/admin'
import { STATUS_LABELS, STATUS_COLORS, SEV_COLORS } from './page'

// Ordem fixa de exibição — não depende da ordem que o Postgres devolve o
// jsonb_object_agg (chaves sem contagem simplesmente não aparecem).
const STATUS_ORDEM = ['aberto', 'em_analise', 'resolvido', 'ignorado']
const SEVERIDADE_ORDEM = ['critica', 'alta', 'media', 'baixa', 'sem_analise']
const SEVERIDADE_LABELS: Record<string, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  sem_analise: 'Sem análise',
}

type Estatisticas = {
  por_status: Record<string, number>
  por_severidade: Record<string, number>
  por_categoria: { categoria: string; total: number }[]
  por_empresa: { empresa_nome: string; total: number }[]
  por_dia: { dia: string; total: number }[]
  tempo_medio_resolucao_horas: number | null
  tempo_resolucao_por_dia: { dia: string; horas_medias: number | null; resolvidos: number }[]
}

// dia vem como 'YYYY-MM-DD' (texto) da função SQL — parse manual, sem
// Date/toISOString, pra não sofrer deslocamento de fuso horário.
function formatDia(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

function formatHoras(horas: number): string {
  if (horas < 24) return `${horas.toFixed(1).replace('.', ',')} h`
  const dias = horas / 24
  return `${dias.toFixed(1).replace('.', ',')} dias`
}

// AC3: uma única chamada RPC — toda a agregação já vem pronta do banco.
// Nenhum select/fetchAllRows sobre bug_reports aqui.
export async function RelatoriosSection() {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('bug_reports_estatisticas')

  if (error || !data) {
    return (
      <div className="rounded-xl border border-dashed border-border py-20 text-center text-muted-foreground">
        Não foi possível carregar as estatísticas.
      </div>
    )
  }

  const stats = data as Estatisticas
  const maxCategoria = Math.max(...stats.por_categoria.map((c) => c.total), 1)
  const maxEmpresa = Math.max(...stats.por_empresa.map((e) => e.total), 1)
  const maxDia = Math.max(...stats.por_dia.map((d) => d.total), 1)
  const tempoMedio = stats.tempo_medio_resolucao_horas
  const maxHorasResolucao = Math.max(
    ...stats.tempo_resolucao_por_dia.map((d) => d.horas_medias ?? 0),
    1
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Por status */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Bugs por status</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_ORDEM.map((status) => (
            <div key={status} className={`rounded-xl border px-4 py-3 ${STATUS_COLORS[status] ?? ''}`}>
              <p className="text-xs opacity-80">{STATUS_LABELS[status] ?? status}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{stats.por_status[status] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Por severidade */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Bugs por severidade</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SEVERIDADE_ORDEM.filter((sev) => stats.por_severidade[sev] !== undefined).map((sev) => (
            <div key={sev} className={`rounded-xl px-4 py-3 ${SEV_COLORS[sev] ?? 'bg-muted text-muted-foreground'}`}>
              <p className="text-xs font-medium uppercase opacity-80">{SEVERIDADE_LABELS[sev] ?? sev}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{stats.por_severidade[sev]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tempo médio de resolução */}
      <div className="w-fit rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-xs text-muted-foreground">Tempo médio de resolução</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {tempoMedio == null ? '—' : formatHoras(tempoMedio)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Por categoria */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">Bugs por categoria</p>
          {stats.por_categoria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {stats.por_categoria.map(({ categoria, total }) => {
                const pct = Math.round((total / maxCategoria) * 100)
                return (
                  <div key={categoria} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">
                      {categoria === 'sem_categoria' ? 'Sem categoria' : categoria}
                    </span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold text-foreground">{total}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Por empresa */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">Bugs por empresa</p>
          {stats.por_empresa.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {stats.por_empresa.map(({ empresa_nome, total }) => {
                const pct = Math.round((total / maxEmpresa) * 100)
                return (
                  <div key={empresa_nome} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{empresa_nome}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold text-foreground">{total}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Últimos 30 dias */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-semibold text-foreground">Bugs reportados nos últimos 30 dias</p>
        {stats.por_dia.every((d) => d.total === 0) ? (
          <p className="text-sm text-muted-foreground">Nenhum bug reportado no período.</p>
        ) : (
          <>
            <div className="flex h-32 items-end gap-1">
              {stats.por_dia.map(({ dia, total }) => {
                const alturaPct = Math.max(Math.round((total / maxDia) * 100), total > 0 ? 4 : 2)
                return (
                  <div
                    key={dia}
                    title={`${formatDia(dia)}: ${total} bug${total === 1 ? '' : 's'}`}
                    className={`w-full flex-1 rounded-t-sm ${total > 0 ? 'bg-primary' : 'bg-secondary'}`}
                    style={{ height: `${alturaPct}%` }}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{formatDia(stats.por_dia[0].dia)}</span>
              <span>{formatDia(stats.por_dia[stats.por_dia.length - 1].dia)}</span>
            </div>
          </>
        )}
      </div>

      {/* Tempo de resolução por dia */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-semibold text-foreground">Tempo de resolução por dia</p>
        {stats.tempo_resolucao_por_dia.every((d) => d.horas_medias == null) ? (
          <p className="text-sm text-muted-foreground">Nenhum bug resolvido no período.</p>
        ) : (
          <>
            <div className="flex h-32 items-end gap-1">
              {stats.tempo_resolucao_por_dia.map(({ dia, horas_medias, resolvidos }) => {
                const alturaPct =
                  horas_medias == null
                    ? 2
                    : Math.max(Math.round((horas_medias / maxHorasResolucao) * 100), 4)
                const tooltip =
                  horas_medias == null
                    ? `${formatDia(dia)}: sem resolução`
                    : `${formatDia(dia)}: ${formatHoras(horas_medias)}, ${resolvidos} resolvido${resolvidos === 1 ? '' : 's'}`
                return (
                  <div
                    key={dia}
                    title={tooltip}
                    className={`w-full flex-1 rounded-t-sm ${horas_medias != null ? 'bg-primary' : 'bg-secondary'}`}
                    style={{ height: `${alturaPct}%` }}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{formatDia(stats.tempo_resolucao_por_dia[0].dia)}</span>
              <span>
                {formatDia(stats.tempo_resolucao_por_dia[stats.tempo_resolucao_por_dia.length - 1].dia)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
