import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarApiKey } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { gerarGradeSlots, sobrepoe, formatarSlotPtBr } from '@/lib/sdr-agenda'

/**
 * GET /api/leads/disponibilidade
 *
 * Candidatos de horário REAIS pra Leila oferecer ao lead — seg-sex, 9h às
 * 16h (início do último slot; termina às 17h), checando `calendario_eventos`
 * (sincronizado do Google) E `reunioes_sdr` (pendente/confirmada) das sócias
 * da empresa. Prioriza slot onde TODAS as sócias com Google conectado estão
 * livres (reunião conjunta) antes de individual; no fallback individual,
 * balanceia por quem tem menos reuniões marcadas no período (entra primeiro,
 * alternando entre os candidatos oferecidos).
 *
 * Autenticação idêntica a /api/leads/ingest: Bearer <api_key> →
 * verificarApiKey() resolve empresaId — NUNCA por query/corpo (AC11).
 *
 * Sócia sem `google_refresh_token` (ex.: ainda não conectou em /minha-conta)
 * não entra em NENHUM cálculo — nem conjunta nem individual — porque não dá
 * pra checar a agenda dela nem criar evento nela (caso de borda documentado
 * na spec: o agendamento cai automaticamente pra individual com a outra
 * sócia, sem travar o fluxo).
 */

const MAX_CANDIDATOS = 3
const DIAS_UTEIS_DEFAULT = 10
const DIAS_UTEIS_MAX = 20

interface SociaRow {
  id: string
  full_name: string
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expiry: string | null
}
interface SociaComAgenda extends SociaRow {
  google_refresh_token: string
}

interface Candidato {
  inicio: string
  fim: string
  tipo: 'conjunta' | 'individual'
  socias_ids: string[]
  label: string
}

export async function GET(req: NextRequest) {
  const auth = await verificarApiKey(req.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ error: 'API key inválida ou ausente.' }, { status: 401 })
  }
  const empresaId = auth.empresaId

  if (!(await rateLimit(`leads-disponibilidade:${empresaId}`, 120, 60))) {
    return NextResponse.json({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }, { status: 429 })
  }

  const diasParam = Number(req.nextUrl.searchParams.get('dias'))
  const diasUteis = Number.isFinite(diasParam) && diasParam > 0
    ? Math.min(Math.round(diasParam), DIAS_UTEIS_MAX)
    : DIAS_UTEIS_DEFAULT

  const db = createAdminClient()

  const { data: sociasRows, error: errSocias } = await db
    .from('profiles')
    .select('id, full_name, google_access_token, google_refresh_token, google_token_expiry')
    .eq('empresa_id', empresaId)
    .in('role', ['admin', 'socio'])
    .order('created_at', { ascending: true })

  if (errSocias) {
    console.error('[disponibilidade] erro ao buscar sócias:', errSocias.message)
    return NextResponse.json({ error: 'Erro interno ao consultar a agenda.' }, { status: 500 })
  }

  const socias = (sociasRows ?? []) as SociaRow[]
  if (socias.length === 0) {
    return NextResponse.json({ error: 'Nenhum responsável configurado para agendamento.' }, { status: 422 })
  }

  // Só sócias com Google conectado entram no cálculo — ver comentário no topo.
  const comAgenda = socias.filter((s): s is SociaComAgenda => !!s.google_refresh_token)
  if (comAgenda.length === 0) {
    return NextResponse.json({ ok: true, modo: 'indisponivel', candidatos: [] })
  }

  const grade = gerarGradeSlots(diasUteis)
  if (grade.length === 0) {
    return NextResponse.json({ ok: true, modo: 'indisponivel', candidatos: [] })
  }
  const janelaInicio = grade[0].inicio
  const janelaFim = grade[grade.length - 1].fim
  const comAgendaIds = comAgenda.map((s) => s.id)

  const [{ data: eventosOcupados, error: errEventos }, { data: reunioesOcupadas, error: errReunioes }] = await Promise.all([
    db.from('calendario_eventos')
      .select('organizer_user_id, data_inicio, data_fim')
      .eq('empresa_id', empresaId)
      .in('organizer_user_id', comAgendaIds)
      .not('data_inicio', 'is', null)
      .not('data_fim', 'is', null)
      .lt('data_inicio', janelaFim)
      .gt('data_fim', janelaInicio),
    db.from('reunioes_sdr')
      .select('confirmantes, data_inicio, data_fim')
      .eq('empresa_id', empresaId)
      .in('status', ['pendente', 'confirmada'])
      .lt('data_inicio', janelaFim)
      .gt('data_fim', janelaInicio),
  ])

  if (errEventos || errReunioes) {
    console.error('[disponibilidade] erro ao consultar ocupação:', errEventos?.message, errReunioes?.message)
    return NextResponse.json({ error: 'Erro interno ao consultar a agenda.' }, { status: 500 })
  }

  // Mapa sócia -> intervalos ocupados (calendario_eventos + reunioes_sdr).
  const ocupacao = new Map<string, { inicio: string; fim: string }[]>()
  for (const id of comAgendaIds) ocupacao.set(id, [])
  for (const ev of eventosOcupados ?? []) {
    const id = ev.organizer_user_id as string
    ocupacao.get(id)?.push({ inicio: ev.data_inicio as string, fim: ev.data_fim as string })
  }
  for (const reuniao of reunioesOcupadas ?? []) {
    const confirmantes = (reuniao.confirmantes as string[] | null) ?? []
    for (const id of confirmantes) {
      ocupacao.get(id)?.push({ inicio: reuniao.data_inicio as string, fim: reuniao.data_fim as string })
    }
  }

  function livre(sociaId: string, inicio: string, fim: string): boolean {
    const intervalos = ocupacao.get(sociaId) ?? []
    return !intervalos.some((iv) => sobrepoe(inicio, fim, iv.inicio, iv.fim))
  }

  // Contagem de reuniões (pendente/confirmada) no período, por sócia — decide
  // quem "entra primeiro" no fallback individual.
  const contagem = new Map<string, number>()
  for (const id of comAgendaIds) contagem.set(id, 0)
  for (const reuniao of reunioesOcupadas ?? []) {
    const confirmantes = (reuniao.confirmantes as string[] | null) ?? []
    for (const id of confirmantes) {
      if (contagem.has(id)) contagem.set(id, (contagem.get(id) ?? 0) + 1)
    }
  }

  const candidatos: Candidato[] = []

  // 1) Passada CONJUNTA — só faz sentido com 2+ sócias com agenda conectada.
  // Varre a JANELA INTEIRA antes de desistir (regra da spec: só cai pra
  // individual quando não há NENHUM slot conjunto nos dias considerados).
  if (comAgenda.length >= 2) {
    for (const slot of grade) {
      if (candidatos.length >= MAX_CANDIDATOS) break
      const todasLivres = comAgendaIds.every((id) => livre(id, slot.inicio, slot.fim))
      if (todasLivres) {
        candidatos.push({
          inicio: slot.inicio,
          fim: slot.fim,
          tipo: 'conjunta',
          socias_ids: comAgendaIds,
          label: formatarSlotPtBr(slot.inicio),
        })
      }
    }
  }

  // 2) Fallback INDIVIDUAL — balanceado: cada candidato tenta começar pela
  // sócia menos ocupada, alternando (round-robin) a sócia "preferida" a cada
  // novo candidato oferecido, pra não empilhar tudo numa só.
  if (candidatos.length === 0) {
    const ordemBalanceada = [...comAgenda].sort(
      (a, b) => (contagem.get(a.id) ?? 0) - (contagem.get(b.id) ?? 0),
    )
    let rotacao = 0
    for (const slot of grade) {
      if (candidatos.length >= MAX_CANDIDATOS) break
      for (let i = 0; i < ordemBalanceada.length; i++) {
        const socia = ordemBalanceada[(rotacao + i) % ordemBalanceada.length]
        if (livre(socia.id, slot.inicio, slot.fim)) {
          candidatos.push({
            inicio: slot.inicio,
            fim: slot.fim,
            tipo: 'individual',
            socias_ids: [socia.id],
            label: formatarSlotPtBr(slot.inicio),
          })
          rotacao++
          break
        }
      }
    }
  }

  const modo: 'conjunta' | 'individual' | 'indisponivel' =
    candidatos.length === 0 ? 'indisponivel' : candidatos[0].tipo

  return NextResponse.json({ ok: true, modo, candidatos })
}
