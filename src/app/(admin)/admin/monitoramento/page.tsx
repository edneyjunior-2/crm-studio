import { Activity } from 'lucide-react'
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
const STATUS_LABELS: Record<SensorStatus, string> = {
  ok: 'OK',
  alerta: 'Alerta',
  critico: 'Crítico',
}

const formatarData = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

export default async function MonitoramentoPage() {
  const db = createAdminClient()

  const { data, error } = await db
    .from('monitoramento_status')
    .select('chave, nome, area, status, detalhe, desde, ultimo_alerta_em, atualizado_em')
    .order('area')
    .order('nome')

  const sensores = (data ?? []) as Sensor[]

  const areas = sensores.reduce<Record<string, Sensor[]>>((acc, s) => {
    ;(acc[s.area] ??= []).push(s)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monitor da EJLABS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status dos sensores operacionais · atualizado pelo cron a cada 10 minutos
        </p>
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
        <div className="flex flex-col gap-6">
          {Object.entries(areas).map(([area, itens]) => (
            <section key={area} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">{area}</h2>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {itens.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {itens.map((s) => (
                  <li
                    key={s.chave}
                    className={`flex flex-col gap-1 rounded-lg border p-3 ${STATUS_COLORS[s.status]}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{s.nome}</span>
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold">
                        {STATUS_LABELS[s.status]}
                      </span>
                    </div>
                    {s.detalhe && <p className="text-xs opacity-90">{s.detalhe}</p>}
                    {s.desde && (
                      <p className="text-xs opacity-75">
                        com problema desde {formatarData(s.desde)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
