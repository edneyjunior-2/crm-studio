import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

type SensorStatus = 'ok' | 'alerta' | 'critico'

interface Sensor {
  chave: string
  nome: string
  area: string
  status: SensorStatus
  detalhe: string
  desde: string | null
  ultimo_alerta_em: string | null
  atualizado_em: string
}

// Mesma paleta já usada no dashboard admin (src/app/(admin)/admin/page.tsx)
const STATUS_COLORS: Record<SensorStatus, string> = {
  ok: 'bg-green-50 text-green-700 border-green-200',
  alerta: 'bg-amber-50 text-amber-700 border-amber-200',
  critico: 'bg-red-50 text-red-700 border-red-200',
}
const STATUS_DOT: Record<SensorStatus, string> = {
  ok: 'bg-green-500',
  alerta: 'bg-amber-500',
  critico: 'bg-red-500',
}
const STATUS_LABELS: Record<SensorStatus, string> = {
  ok: 'OK',
  alerta: 'Alerta',
  critico: 'Crítico',
}

const formatarData = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

// Helper que encapsula o "agora" (evita Date.now() direto no corpo do componente,
// mesmo padrão de src/app/(admin)/admin/page.tsx).
function nowMs(): number {
  return Date.now()
}
function haTempo(iso: string, agora: number): string {
  const diffMin = Math.floor((agora - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`
  const h = Math.floor(diffMin / 60)
  if (h < 48) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

export default async function MonitoramentoPage() {
  const db = createAdminClient()
  const agora = nowMs()

  const { data, error } = await db
    .from('monitoramento_status')
    .select('chave, nome, area, status, detalhe, desde, ultimo_alerta_em, atualizado_em')
    .order('area')
    .order('nome')

  const sensores = (data ?? []) as Sensor[]
  const problemas = sensores.filter((s) => s.status !== 'ok')

  const contagem: Record<SensorStatus, number> = { ok: 0, alerta: 0, critico: 0 }
  for (const s of sensores) contagem[s.status]++

  const ultimaAtualizacao = sensores.reduce<string | null>(
    (max, s) => (!max || s.atualizado_em > max ? s.atualizado_em : max),
    null,
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Centro de Monitoramento{' '}
            <span className="font-logo font-extrabold tracking-[-0.03em]">
              CRM Studio<span className="text-accent">.</span>
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Status dos sensores operacionais · o cron recalcula a cada 10 minutos
          </p>
        </div>
        {ultimaAtualizacao && (
          <p className="text-xs text-muted-foreground">Atualizado {haTempo(ultimaAtualizacao, agora)}</p>
        )}
      </div>

      {error ? (
        <p className="py-6 text-center text-sm text-red-700">
          Erro ao carregar o monitoramento: {error.message}
        </p>
      ) : sensores.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Ainda sem dados — o cron de monitoramento roda a cada 10 minutos.
        </p>
      ) : (
        <>
          {/* Resumo — visão de relance, sem precisar rolar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={Activity} label="Sensores" value={sensores.length} />
            <Kpi icon={CheckCircle2} label="OK" value={contagem.ok} tone="ok" />
            <Kpi icon={AlertTriangle} label="Alerta" value={contagem.alerta} tone="alerta" />
            <Kpi icon={XCircle} label="Crítico" value={contagem.critico} tone="critico" />
          </div>

          {/* Só o que precisa de atenção fica em destaque — o resto vive na tabela */}
          {problemas.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">Precisa de atenção</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {problemas.map((s) => (
                  <div
                    key={s.chave}
                    className={`flex flex-col gap-1 rounded-xl border p-4 ${STATUS_COLORS[s.status]}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{s.nome}</span>
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold">
                        {STATUS_LABELS[s.status]}
                      </span>
                    </div>
                    <p className="text-xs opacity-70">{s.area}</p>
                    {s.detalhe && <p className="text-xs opacity-90">{s.detalhe}</p>}
                    {s.desde && <p className="text-xs opacity-75">com problema desde {formatarData(s.desde)}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tabela compacta com todos os sensores — cabe na tela sem rolar */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Todos os sensores</h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Sensor</th>
                    <th className="px-4 py-2.5">Área</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Detalhe</th>
                    <th className="px-4 py-2.5 text-right">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {sensores.map((s, i) => {
                    // Área só aparece na 1ª linha do grupo — reduz repetição visual
                    // (a query já vem ordenada por área, então isso agrupa de graça).
                    const areaRepetida = i > 0 && sensores[i - 1].area === s.area
                    return (
                      <tr key={s.chave} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium text-foreground">{s.nome}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{areaRepetida ? '' : s.area}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[s.status]}`}
                          >
                            <span className={`size-1.5 rounded-full ${STATUS_DOT[s.status]}`} />
                            {STATUS_LABELS[s.status]}
                          </span>
                        </td>
                        <td className="max-w-sm px-4 py-2.5 text-muted-foreground">{s.detalhe}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                          {haTempo(s.atualizado_em, agora)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Kpi({
  icon: Icon, label, value, tone,
}: {
  icon: React.ElementType
  label: string
  value: number
  tone?: SensorStatus
}) {
  const toneClass = tone ? STATUS_COLORS[tone] : 'border-border bg-card text-foreground'
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-5 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
