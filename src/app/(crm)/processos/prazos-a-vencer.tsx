import Link from 'next/link'
import { CalendarClock, AlertTriangle } from 'lucide-react'

type PrazoRow = {
  id: string
  processo_id: string
  descricao: string
  data_prazo: string
  processos_juridicos: { numero_processo: string } | null
  profiles: { full_name: string } | null
}

function urgenciaBadge(dataPrazo: string) {
  // Calcular diff em dias sem toISOString — usando data local
  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const [ay, am, ad] = hojeStr.split('-').map(Number)
  const [by, bm, bd] = dataPrazo.split('-').map(Number)
  const hojeMs = Date.UTC(ay, am - 1, ad)
  const prazoMs = Date.UTC(by, bm - 1, bd)
  const dias = Math.round((prazoMs - hojeMs) / (1000 * 60 * 60 * 24))

  if (dias < 0) {
    return {
      label: `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}`,
      className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    }
  }
  if (dias === 0) {
    return {
      label: 'Vence hoje',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    }
  }
  if (dias <= 3) {
    return {
      label: `${dias} dia${dias !== 1 ? 's' : ''}`,
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    }
  }
  return {
    label: `${dias} dias`,
    className: 'bg-secondary text-muted-foreground',
  }
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

interface PrazosAVencerProps {
  prazos: PrazoRow[]
}

export function PrazosAVencer({ prazos }: PrazosAVencerProps) {
  if (prazos.length === 0) return null

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/10 p-4">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Prazos a vencer
        </h3>
        <span className="ml-auto text-xs text-amber-600 dark:text-amber-500">
          próximos 30 dias
        </span>
      </div>

      {/* Lista de prazos */}
      <ul className="flex flex-col gap-1.5">
        {prazos.map((prazo) => {
          const badge = urgenciaBadge(prazo.data_prazo)
          const numero = prazo.processos_juridicos?.numero_processo ?? '—'
          const responsavel = prazo.profiles?.full_name ?? null
          const isVencido = badge.label.startsWith('Vencido')

          return (
            <li key={prazo.id}>
              <Link
                href={`/processos/${prazo.processo_id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/70 dark:bg-white/5 px-3 py-2 text-sm transition-colors hover:bg-white dark:hover:bg-white/10"
              >
                {/* Data */}
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                  {formatDate(prazo.data_prazo)}
                </span>

                {/* Badge urgência */}
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${badge.className}`}
                >
                  {badge.label}
                </span>

                {/* Descrição */}
                <span className={`flex-1 truncate ${isVencido ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
                  {prazo.descricao}
                </span>

                {/* Número do processo */}
                <span className="shrink-0 font-mono text-xs text-primary">
                  {numero}
                </span>

                {/* Responsável */}
                {responsavel && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {responsavel}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Aviso se há vencidos */}
      {prazos.some((p) => urgenciaBadge(p.data_prazo).label.startsWith('Vencido')) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="size-3.5 shrink-0" />
          Prazos vencidos exigem atenção imediata.
        </p>
      )}
    </section>
  )
}
