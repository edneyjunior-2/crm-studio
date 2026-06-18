import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from 'lucide-react'
import { GoogleCalendarConnect } from '@/components/crm/google/google-calendar-connect'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listCalendarEvents, listEvents, isConfigured, CALENDAR_ID } from '@/lib/google-calendar'
import { getFeriados, getFeriadoNoDia } from '@/lib/feriados'
import { getAniversariosDoMes } from '@/lib/aniversarios'
import type { Aniversario } from '@/lib/aniversarios'
import { SemanaView } from '@/components/crm/calendario/semana-view'
import { MesView } from '@/components/crm/calendario/mes-view'
import { NovoEventoDialog } from '@/components/crm/calendario/novo-evento-dialog'
import { NovoBloqueioDialog } from '@/components/crm/calendario/novo-bloqueio-dialog'
import { ExportarSemanaBtn } from '@/components/crm/calendario/exportar-semana-btn'
import { Relogio } from '@/components/crm/calendario/relogio'
import { NotificacoesDialog } from '@/components/crm/calendario/notificacoes-dialog'
import type { CalendarioNotificacao } from '@/components/crm/calendario/notificacoes-dialog'
import { cn } from '@/lib/utils'
import type { AgendaBloqueio } from '@/types'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export type MembroInterno = { id: string; nome: string; email: string }
export type { Aniversario }
export type NotaEvento = { texto: string; updated_by: string; updated_at: string }

function getWeekDates(referencia: Date): Date[] {
  const day = referencia.getDay()
  const sunday = new Date(referencia)
  sunday.setDate(referencia.getDate() - day)
  sunday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return d
  })
}

function dateToParam(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

function parseParamDate(param: string | undefined): Date {
  if (!param) return new Date()
  const parts = param.split('-')
  if (parts.length !== 3) return new Date()
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  return isNaN(date.getTime()) ? new Date() : date
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n * 7)
  return r
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; mes?: string; visao?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const visao = params.visao === 'mes' ? 'mes' : 'semana'

  // Datas de referência
  const referencia = parseParamDate(params.semana ?? params.mes)
  const weekDates = getWeekDates(referencia)
  const mesAtual = visao === 'mes' ? referencia.getMonth() : weekDates[3].getMonth()
  const anoAtual = visao === 'mes' ? referencia.getFullYear() : weekDates[3].getFullYear()

  // Navegação semana
  const semanaAnterior = dateToParam(addWeeks(weekDates[0], -1))
  const proximaSemana  = dateToParam(addWeeks(weekDates[0], 1))

  // Navegação mês
  const refMes = new Date(anoAtual, mesAtual, 1)
  const mesAnterior  = dateToParam(addMonths(refMes, -1))
  const proximoMes   = dateToParam(addMonths(refMes, 1))

  // Feriados do ano corrente
  const feriados = getFeriados(anoAtual)

  // Aniversários do período
  const aniversarios =
    visao === 'mes'
      ? getAniversariosDoMes(anoAtual, mesAtual)
      : [
          ...getAniversariosDoMes(weekDates[0].getFullYear(), weekDates[0].getMonth()),
          ...getAniversariosDoMes(weekDates[6].getFullYear(), weekDates[6].getMonth()),
        ].filter(
          (a, idx, arr) => arr.findIndex((b) => b.data === a.data) === idx,
        )

  const configured = isConfigured()
  const { data: myProfile } = await supabase.from('profiles').select('google_refresh_token').eq('id', user.id).single()
  const isGoogleConnected = !!myProfile?.google_refresh_token
  let events: Awaited<ReturnType<typeof listEvents>> = []

  const admin = createAdminClient()

  // Faixa de datas para bloqueios
  const bloqueioInicio = visao === 'mes'
    ? dateToParam(new Date(anoAtual, mesAtual, 1))
    : dateToParam(weekDates[0])
  const bloqueioFim = visao === 'mes'
    ? dateToParam(new Date(anoAtual, mesAtual + 1, 0))
    : dateToParam(weekDates[6])

  const [
    { data: authUsers },
    { data: profiles },
    { data: contatosSalvos },
    { data: bloqueiosRaw },
    { data: notificacoesRaw },
    { data: notasRaw },
  ] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from('profiles').select('id, full_name'),
    admin.from('calendario_contatos').select('email, nome').order('email'),
    admin.from('agenda_bloqueios')
      .select('id, user_id, titulo, descricao, data, hora_inicio, hora_fim, created_at')
      .gte('data', bloqueioInicio)
      .lte('data', bloqueioFim)
      .order('data', { ascending: true })
      .order('hora_inicio', { ascending: true }),
    supabase
      .from('calendario_notificacoes')
      .select('id, event_id, event_title, changed_by_nome, campo, valor_anterior, valor_novo, created_at')
      .eq('notified_user_id', user.id)
      .eq('seen', false)
      .order('created_at', { ascending: false }),
    admin
      .from('calendario_notas')
      .select('event_id, texto, updated_by, updated_at'),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name as string]))
  const membrosInternos: MembroInterno[] = (authUsers?.users ?? [])
    .filter((u) => u.email)
    .map((u) => ({ id: u.id, nome: profileMap[u.id] ?? u.email!.split('@')[0], email: u.email! }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const contatosExternos: string[] = (contatosSalvos ?? []).map((c) => c.email)

  // Enriquecer bloqueios com nome do usuário (para exibir de quem é quando for de outro)
  const bloqueios: (AgendaBloqueio & { nomeUsuario?: string })[] = (bloqueiosRaw ?? []).map((b) => ({
    ...b,
    descricao: b.descricao ?? null,
    nomeUsuario: b.user_id !== user.id ? (profileMap[b.user_id] ?? undefined) : undefined,
  }))

  // Notificações não vistas do usuário logado
  const notificacoesPendentes: CalendarioNotificacao[] = (notificacoesRaw ?? []) as CalendarioNotificacao[]

  // Notas indexadas por event_id
  const notas: Record<string, NotaEvento> = Object.fromEntries(
    (notasRaw ?? []).map((n) => [
      n.event_id,
      { texto: n.texto, updated_by: n.updated_by, updated_at: n.updated_at },
    ]),
  )

  if (configured) {
    const timeMin = visao === 'mes'
      ? `${dateToParam(new Date(anoAtual, mesAtual, 1))}T00:00:00-03:00`
      : `${dateToParam(weekDates[0])}T00:00:00-03:00`
    const timeMax = visao === 'mes'
      ? `${dateToParam(new Date(anoAtual, mesAtual + 1, 0))}T23:59:59-03:00`
      : `${dateToParam(weekDates[6])}T23:59:59-03:00`

    // Busca do calendário compartilhado + calendário primário de cada membro do time.
    // Cada membro cria eventos no próprio 'primary' via DWD — precisamos buscar em todos.
    const allEmails = membrosInternos.map((m) => m.email)
    const fetches = await Promise.all([
      listCalendarEvents(CALENDAR_ID, timeMin, timeMax),
      ...allEmails.map((email) => listCalendarEvents('primary', timeMin, timeMax, email)),
    ])

    // Mescla e deduplica por ID (um evento pode aparecer em múltiplas fontes)
    const seen = new Set<string>()
    const merged: typeof events = []
    for (const batch of fetches) {
      for (const ev of batch) {
        if (ev.id && !seen.has(ev.id)) {
          seen.add(ev.id)
          merged.push(ev)
        }
      }
    }
    events = merged.sort((a, b) => {
      const at = a.start?.dateTime ?? a.start?.date ?? ''
      const bt = b.start?.dateTime ?? b.start?.date ?? ''
      return at.localeCompare(bt)
    })
  }

  const tituloHeader = visao === 'mes'
    ? new Date(anoAtual, mesAtual, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : weekDates[3].toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Links de navegação preservando a visão
  const navAnterior = visao === 'mes'
    ? `/calendario?mes=${mesAnterior}&visao=mes`
    : `/calendario?semana=${semanaAnterior}`
  const navProximo  = visao === 'mes'
    ? `/calendario?mes=${proximoMes}&visao=mes`
    : `/calendario?semana=${proximaSemana}`
  const navHoje     = visao === 'mes' ? '/calendario?visao=mes' : '/calendario'
  const labelAnterior = visao === 'mes' ? 'Mês anterior' : 'Semana anterior'
  const labelProximo  = visao === 'mes' ? 'Próximo mês'  : 'Próxima semana'

  return (
    <div className="flex flex-col gap-6">

      {/* Dialog de notificações — abre automaticamente se há pendências */}
      {notificacoesPendentes.length > 0 && (
        <NotificacoesDialog notificacoes={notificacoesPendentes} />
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendário</h1>
          <p className="mt-0.5 text-sm text-muted-foreground capitalize">{tituloHeader}</p>
        </div>
        {configured && (
          <div className="flex items-center gap-2">
            {visao === 'semana' && (
              <ExportarSemanaBtn
                eventos={events.map((ev) => ({
                  id: ev.id,
                  summary: ev.summary,
                  start: ev.start
                    ? { dateTime: ev.start.dateTime ?? null, date: ev.start.date ?? null }
                    : null,
                  end: ev.end
                    ? { dateTime: ev.end.dateTime ?? null, date: ev.end.date ?? null }
                    : null,
                  organizer: ev.organizer ? { email: ev.organizer.email ?? null } : null,
                }))}
                bloqueios={bloqueios.map((b) => ({
                  id: b.id,
                  user_id: b.user_id,
                  titulo: b.titulo,
                  data: b.data,
                  hora_inicio: b.hora_inicio,
                  hora_fim: b.hora_fim,
                  nomeUsuario: b.nomeUsuario,
                }))}
                weekDates={weekDates.map((d) => dateToParam(d))}
                membrosInternos={membrosInternos}
              />
            )}
            <NovoBloqueioDialog />
            <NovoEventoDialog membrosInternos={membrosInternos} contatosExternos={contatosExternos} />
          </div>
        )}
      </div>

      {/* Conectar Google Calendar */}
      {!configured && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <div>
            <h2 className="text-base font-semibold">Conecte seu Google Calendar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sincronize reuniões e compromissos em 3 passos — leva menos de 1 minuto.
            </p>
          </div>
          <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">1</span>
              Clique em <strong className="text-foreground">Conectar Google Calendar</strong> abaixo
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">2</span>
              Autorize o acesso na janela do Google que vai abrir
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">3</span>
              Pronto — seus eventos aparecem aqui automaticamente
            </li>
          </ol>
          <GoogleCalendarConnect isConnected={isGoogleConnected} />
        </div>
      )}

      {/* Barra de navegação — centralizada e maior */}
      <div className="flex flex-col items-center gap-3">
        {/* Toggle semana / mês */}
        <div className="flex rounded-lg border border-border bg-muted/40 p-1">
          <Link
            href={`/calendario${params.semana ? `?semana=${params.semana}` : ''}`}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              visao === 'semana'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarDays className="size-4" />
            Semana
          </Link>
          <Link
            href={`/calendario?visao=mes${params.mes ? `&mes=${params.mes}` : ''}`}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              visao === 'mes'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="size-4" />
            Mês
          </Link>
        </div>

        {/* Navegação anterior / hoje / próximo */}
        <div className="flex items-center gap-2">
          <Link
            href={navAnterior}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
            {labelAnterior}
          </Link>
          <Link
            href={navHoje}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Hoje
          </Link>
          <Link
            href={navProximo}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            {labelProximo}
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Conteúdo principal */}
      {configured ? (
        visao === 'mes' ? (
          <MesView
            events={events}
            ano={anoAtual}
            mes={mesAtual}
            feriados={feriados}
            aniversarios={aniversarios}
            membrosInternos={membrosInternos}
            contatosExternos={contatosExternos}
            bloqueios={bloqueios}
            notas={notas}
            currentUserId={user.id}
            currentUserEmail={user.email ?? ''}
          />
        ) : (
          <SemanaView
            events={events}
            weekDates={weekDates}
            feriados={feriados}
            aniversarios={aniversarios}
            membrosInternos={membrosInternos}
            contatosExternos={contatosExternos}
            bloqueios={bloqueios}
            notas={notas}
            currentUserId={user.id}
            currentUserEmail={user.email ?? ''}
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2 pointer-events-none opacity-50">
            {weekDates.map((date, i) => {
              const diaNum = date.getDate().toString().padStart(2, '0')
              const mesNum = (date.getMonth() + 1).toString().padStart(2, '0')
              const dateStr = `${date.getFullYear()}-${mesNum}-${diaNum}`
              const feriado = getFeriadoNoDia(feriados, dateStr)
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className={cn(
                    'flex flex-col items-center rounded-lg py-2',
                    feriado ? 'bg-red-50' : 'bg-muted/40'
                  )}>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {DIAS_SEMANA[date.getDay()]}
                    </span>
                    <span className="mt-0.5 text-lg font-bold leading-none text-foreground">{diaNum}</span>
                    <span className="text-[10px] text-muted-foreground">{mesNum}</span>
                    {feriado && (
                      <span className="mt-0.5 px-1 text-[9px] font-medium text-red-500 text-center leading-tight">
                        {feriado.nome}
                      </span>
                    )}
                  </div>
                  <div className="rounded-md border border-dashed border-border px-2 py-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Sem eventos</p>
                  </div>
                </div>
              )
            })}
          </div>
          <Relogio />
        </>
      )}
    </div>
  )
}
