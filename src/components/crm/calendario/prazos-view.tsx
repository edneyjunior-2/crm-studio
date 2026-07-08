import Link from 'next/link'
import { AlarmClock, AlertTriangle, CheckCircle2, Gavel, MapPin, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MembroInterno } from '@/app/(crm)/calendario/page'
import type { PrazoCalendario, AudienciaCalendario } from '@/lib/processos-prazos-calendario'
import { AgendarAudienciaDialog } from '@/app/(crm)/processos/[id]/agendar-audiencia-dialog'

// data `date` ('YYYY-MM-DD'): parse por componentes, nunca `new Date()` cru
// (interpretaria como UTC e poderia recuar um dia em BRT). Mesmo padrão de
// processos/[id]/page.tsx e processos/prazos-a-vencer.tsx.
function formatarData(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return data
  return `${dia}/${mes}/${ano}`
}

function hojeStr(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

interface PrazosViewProps {
  prazos: PrazoCalendario[]
  audiencias: AudienciaCalendario[]
  membrosInternos: MembroInterno[]
  currentUserEmail: string
}

export function PrazosView({ prazos, audiencias, membrosInternos, currentUserEmail }: PrazosViewProps) {
  const hoje = hojeStr()
  // Nome do usuário logado (via e-mail) — só para destacar "Você" nos prazos
  // sob sua responsabilidade; processos_prazos guarda responsavel_nome, não e-mail.
  const meuNome = membrosInternos.find((m) => m.email === currentUserEmail)?.nome ?? null

  const pendentes = prazos.filter((p) => !p.cumprido)
  const cumpridos = prazos.filter((p) => p.cumprido)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Seção Prazos */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <AlarmClock className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Prazos</h2>
          <span className="ml-auto text-xs text-muted-foreground">{prazos.length} no total</span>
        </div>

        {prazos.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum prazo cadastrado.</p>
            <Link href="/processos" className="text-xs text-primary underline-offset-2 hover:underline">
              Ver processos
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {pendentes.map((p) => {
              const vencido = p.data_prazo < hoje
              const isMeu = meuNome !== null && p.responsavel_nome === meuNome
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm',
                    vencido
                      ? 'border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/10'
                      : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/10',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none',
                      vencido
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                    )}
                  >
                    {vencido ? 'Vencido' : 'A vencer'}
                  </span>
                  <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                    {formatarData(p.data_prazo)}
                  </span>
                  <span className={cn('flex-1 truncate', vencido ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>
                    {p.descricao}
                  </span>
                  <Link
                    href={`/processos/${p.processo_id}`}
                    className="shrink-0 font-mono text-xs text-primary underline-offset-2 hover:underline"
                  >
                    {p.numero_processo}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {isMeu ? 'Você' : p.responsavel_nome ?? '—'}
                  </span>
                </li>
              )
            })}

            {cumpridos.length > 0 && (
              <>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  Cumpridos ({cumpridos.length})
                </p>
                {cumpridos.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm opacity-60"
                  >
                    <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                      {formatarData(p.data_prazo)}
                    </span>
                    <span className="flex-1 truncate text-muted-foreground line-through">{p.descricao}</span>
                    <Link
                      href={`/processos/${p.processo_id}`}
                      className="shrink-0 font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {p.numero_processo}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{p.responsavel_nome ?? '—'}</span>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}

        {pendentes.some((p) => p.data_prazo < hoje) && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="size-3.5 shrink-0" />
            Há prazos vencidos exigindo atenção imediata.
          </p>
        )}
      </section>

      {/* Seção Audiências */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Gavel className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Audiências</h2>
          <span className="ml-auto text-xs text-muted-foreground">{audiencias.length} no total</span>
        </div>

        {audiencias.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma audiência encontrada.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {audiencias.map((a) => {
              const local = [a.vara, a.comarca].filter(Boolean).join(' — ')
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs text-muted-foreground">{formatarData(a.data)}</span>
                      <span className="truncate text-foreground">{a.descricao}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <Link
                        href={`/processos/${a.processo_id}`}
                        className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 hover:underline"
                      >
                        {a.numero_processo}
                        <ArrowUpRight className="size-3" />
                      </Link>
                      {a.cliente_nome && <span>· {a.cliente_nome}</span>}
                      {local && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          {local}
                        </span>
                      )}
                      {a.complemento && <span className="truncate">· {a.complemento}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">Enviar para o calendário</span>
                    <AgendarAudienciaDialog
                      descricao={a.descricao}
                      dataSugerida={a.data}
                      processoNumero={a.numero_processo}
                      vara={a.vara}
                      comarca={a.comarca}
                      clienteNome={a.cliente_nome}
                      areaLabel={null}
                      advogadoEmail={a.advogado_email}
                      membros={membrosInternos}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
