import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarApiKey } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/calendar'
import { slotNaGrade, fimDoSlot, formatarSlotPtBr } from '@/lib/sdr-agenda'

/**
 * POST /api/leads/reuniao
 *
 * Confirma um slot escolhido pelo lead: RE-VALIDA que ainda está livre
 * (consulta fresca — nunca confia na resposta anterior de /disponibilidade,
 * AC3), cria o evento no Google Calendar (attendees: sócia(s) + lead se tiver
 * e-mail; Meet só se tipo==='video'), espelha em `calendario_eventos` (mesmos
 * campos que a action `criarEvento` grava — ver
 * src/app/(crm)/calendario/actions.ts) e grava `reunioes_sdr` com
 * status='pendente' (AC5 — nunca nasce confirmada).
 *
 * Trava anti-corrida (AC3): antes de tocar no Google, tenta inserir uma linha
 * por sócia em `reunioes_sdr_travas` NUM ÚNICO insert multi-linha. Como todo
 * slot é alinhado à grade fixa (hora cheia), duas reuniões só colidem de
 * verdade quando (sócia, data_inicio) coincidem exatamente — por isso a
 * UNIQUE(socia_id, data_inicio) da trava fecha a corrida sem precisar de
 * range/exclusion constraint: se o insert falhar com 23505, esta requisição
 * perdeu a corrida e nenhum evento duplicado é criado.
 *
 * Autenticação idêntica a /api/leads/ingest — empresaId só de
 * verificarApiKey() (AC11), nunca do corpo.
 */

const reuniaoSchema = z
  .object({
    inicio: z.string().trim().min(10, 'inicio é obrigatório'),
    tipo: z.enum(['video', 'presencial']),
    socias_ids: z.array(z.string().uuid()).min(1).max(4),
    lead_nome: z.string().trim().min(1, 'lead_nome é obrigatório').max(200),
    lead_telefone: z.string().trim().transform((v) => v.replace(/\D/g, ''))
      .pipe(z.string().min(10, 'lead_telefone inválido').max(15)),
    lead_email: z.string().trim().email('lead_email inválido').max(200).optional(),
    conversation_id: z.string().uuid('conversation_id inválido'),
    negocio_id: z.string().uuid('negocio_id inválido').optional(),
  })
  .refine((d) => d.tipo !== 'video' || !!d.lead_email, {
    message: 'lead_email é obrigatório para reunião por vídeo.',
    path: ['lead_email'],
  })

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

export async function POST(req: NextRequest) {
  const auth = await verificarApiKey(req.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ error: 'API key inválida ou ausente.' }, { status: 401 })
  }
  const empresaId = auth.empresaId

  if (!(await rateLimit(`leads-reuniao:${empresaId}`, 30, 60))) {
    return NextResponse.json({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 })
  }
  const parsed = reuniaoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados do agendamento inválidos.', detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const input = parsed.data

  if (!slotNaGrade(input.inicio)) {
    return NextResponse.json({ error: 'Horário fora da janela de agendamento (seg-sex, 9h-17h).' }, { status: 400 })
  }
  const inicio = input.inicio
  const fim = fimDoSlot(inicio)

  const db = createAdminClient()

  // 1) Sócias válidas: da empresa, role admin/socio, COM Google conectado —
  // ignora silenciosamente qualquer id que não bata mais (ex.: sócia
  // desconectou o Google entre a chamada de /disponibilidade e esta).
  const { data: sociasRows, error: errSocias } = await db
    .from('profiles')
    .select('id, full_name, google_access_token, google_refresh_token, google_token_expiry')
    .eq('empresa_id', empresaId)
    .in('id', input.socias_ids)
    .in('role', ['admin', 'socio'])

  if (errSocias) {
    console.error('[reuniao] erro ao validar sócias:', errSocias.message)
    return NextResponse.json({ error: 'Erro interno ao validar a agenda.' }, { status: 500 })
  }

  const socias = (sociasRows ?? []).filter((s): s is SociaComAgenda => !!s.google_refresh_token)
  if (socias.length === 0) {
    return NextResponse.json({ error: 'Nenhuma sócia com agenda conectada para este horário.' }, { status: 422 })
  }
  const sociaIds = socias.map((s) => s.id)

  // 2) negocio_id, se veio, precisa ser desta empresa (defesa contra tenant
  // cruzado). Se não bater, ignora silenciosamente (trata como não informado).
  let negocioId: string | null = null
  let clienteId: string | null = null
  if (input.negocio_id) {
    const { data: negocio } = await db
      .from('negocios')
      .select('id, cliente_id')
      .eq('id', input.negocio_id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (negocio) {
      negocioId = negocio.id as string
      clienteId = (negocio.cliente_id as string | null) ?? null
    }
  }

  // 3) A conversa também precisa ser desta empresa.
  const { data: conversa } = await db
    .from('conversations')
    .select('id')
    .eq('id', input.conversation_id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!conversa) {
    return NextResponse.json({ error: 'Conversa não encontrada para esta empresa.' }, { status: 422 })
  }

  // 4) RE-VALIDAÇÃO FRESCA (AC3) — consulta o banco de novo agora; o tempo
  // entre /disponibilidade e esta chamada é exatamente a janela de corrida
  // que este passo (mais a trava do passo 5) precisa fechar.
  const [{ data: eventosConflito, error: errEv }, { data: reunioesConflito, error: errRe }] = await Promise.all([
    db.from('calendario_eventos')
      .select('organizer_user_id')
      .eq('empresa_id', empresaId)
      .in('organizer_user_id', sociaIds)
      .not('data_inicio', 'is', null)
      .not('data_fim', 'is', null)
      .lt('data_inicio', fim)
      .gt('data_fim', inicio),
    db.from('reunioes_sdr')
      .select('confirmantes')
      .eq('empresa_id', empresaId)
      .in('status', ['pendente', 'confirmada'])
      .lt('data_inicio', fim)
      .gt('data_fim', inicio),
  ])
  if (errEv || errRe) {
    console.error('[reuniao] erro na revalidação de disponibilidade:', errEv?.message, errRe?.message)
    return NextResponse.json({ error: 'Erro interno ao validar o horário.' }, { status: 500 })
  }
  const temConflitoEvento = (eventosConflito ?? []).length > 0
  const temConflitoReuniao = (reunioesConflito ?? []).some((r) => {
    const confirmantes = (r.confirmantes as string[] | null) ?? []
    return confirmantes.some((id) => sociaIds.includes(id))
  })
  if (temConflitoEvento || temConflitoReuniao) {
    return NextResponse.json({ error: 'Esse horário não está mais disponível. Escolha outro.', conflito: true }, { status: 409 })
  }

  // 5) Trava anti-corrida — ver comentário no topo do arquivo.
  const { error: errTrava } = await db.from('reunioes_sdr_travas').insert(
    sociaIds.map((sociaId) => ({ empresa_id: empresaId, socia_id: sociaId, data_inicio: inicio })),
  )
  if (errTrava) {
    if (errTrava.code === '23505') {
      return NextResponse.json(
        { error: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.', conflito: true },
        { status: 409 },
      )
    }
    console.error('[reuniao] erro ao travar o slot:', errTrava.message)
    return NextResponse.json({ error: 'Erro interno ao reservar o horário.' }, { status: 500 })
  }

  // A partir daqui o slot está garantidamente nosso — rollback pra qualquer
  // falha abaixo (evita travar o horário pra sempre por causa de um erro).
  async function liberarTrava(): Promise<void> {
    await db.from('reunioes_sdr_travas')
      .delete()
      .eq('empresa_id', empresaId)
      .in('socia_id', sociaIds)
      .eq('data_inicio', inicio)
  }

  // 6) E-mails das sócias (pra attendees) — profiles_auth (só service_role).
  const { data: emailsRows } = await db.from('profiles_auth').select('id, email').in('id', sociaIds)
  const emailPorId = new Map((emailsRows ?? []).map((r) => [r.id as string, r.email as string]))

  const organizadora = socias[0]
  const outrasSocias = socias.slice(1)
  const attendeeEmails = [
    ...outrasSocias.map((s) => emailPorId.get(s.id)).filter((e): e is string => !!e),
    ...(input.lead_email ? [input.lead_email] : []),
  ]

  const titulo = `Diagnóstico — ${input.lead_nome}`
  const descricao =
    `Reunião agendada automaticamente pela Leila (SDR).\n` +
    `Lead: ${input.lead_nome} — ${input.lead_telefone}` +
    (input.lead_email ? ` — ${input.lead_email}` : '')

  let eventoGoogle: { eventId: string; eventUrl: string; meetLink?: string }
  try {
    eventoGoogle = await createCalendarEvent({
      userId: organizadora.id,
      accessToken: organizadora.google_access_token ?? '',
      refreshToken: organizadora.google_refresh_token,
      tokenExpiry: organizadora.google_token_expiry ?? new Date(0).toISOString(),
      title: titulo,
      description: descricao,
      startDateTime: inicio,
      endDateTime: fim,
      attendeeEmails,
      createMeet: input.tipo === 'video',
    })
  } catch (err) {
    await liberarTrava()
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[reuniao] falha ao criar evento no Google Calendar:', message)
    return NextResponse.json({ error: `Falha ao criar o evento na agenda: ${message}` }, { status: 502 })
  }

  // 7) calendario_eventos — mesmos campos que criarEvento grava (ver
  // src/app/(crm)/calendario/actions.ts) — pra /disponibilidade enxergar
  // este horário como ocupado na próxima chamada sem esperar o cron de sync.
  // visivel_equipe:true pra AMBAS as sócias verem o evento em /calendario,
  // mesmo a que não é organizadora.
  const { error: errCalEvento } = await db.from('calendario_eventos').insert({
    event_id: eventoGoogle.eventId,
    calendar_id: 'primary',
    organizer_email: emailPorId.get(organizadora.id) ?? '',
    organizer_user_id: organizadora.id,
    titulo,
    empresa_id: empresaId,
    descricao,
    data_inicio: inicio,
    data_fim: fim,
    visivel_equipe: true,
    meet_link: eventoGoogle.meetLink ?? null,
  })
  if (errCalEvento) {
    console.error('[reuniao] falha ao registrar calendario_eventos:', errCalEvento.message)
    await liberarTrava()
    try {
      await deleteCalendarEvent({
        userId: organizadora.id,
        accessToken: organizadora.google_access_token ?? '',
        refreshToken: organizadora.google_refresh_token,
        tokenExpiry: organizadora.google_token_expiry ?? new Date(0).toISOString(),
        eventId: eventoGoogle.eventId,
      })
    } catch { /* best-effort — não mascara o erro principal */ }
    return NextResponse.json({ error: 'Evento criado, mas falhou ao registrar localmente.' }, { status: 500 })
  }

  // 8) reunioes_sdr — nasce SEMPRE 'pendente' (AC5).
  const { data: reuniaoRow, error: errReuniao } = await db
    .from('reunioes_sdr')
    .insert({
      empresa_id: empresaId,
      negocio_id: negocioId,
      conversation_id: input.conversation_id,
      tipo: input.tipo,
      data_inicio: inicio,
      data_fim: fim,
      lead_nome: input.lead_nome,
      lead_telefone: input.lead_telefone,
      lead_email: input.lead_email ?? null,
      confirmantes: sociaIds,
      status: 'pendente',
      google_event_id: eventoGoogle.eventId,
      google_calendar_id: 'primary',
      meet_link: eventoGoogle.meetLink ?? null,
    })
    .select('id')
    .single()

  if (errReuniao || !reuniaoRow) {
    console.error('[reuniao] falha ao registrar reunioes_sdr:', errReuniao?.message)
    await liberarTrava()
    await db.from('calendario_eventos').delete().eq('event_id', eventoGoogle.eventId)
    try {
      await deleteCalendarEvent({
        userId: organizadora.id,
        accessToken: organizadora.google_access_token ?? '',
        refreshToken: organizadora.google_refresh_token,
        tokenExpiry: organizadora.google_token_expiry ?? new Date(0).toISOString(),
        eventId: eventoGoogle.eventId,
      })
    } catch { /* best-effort */ }
    return NextResponse.json({ error: 'Erro interno ao registrar a reunião.' }, { status: 500 })
  }

  // 9) Vincula a trava à reunião (best-effort — útil pra liberar o horário
  // de novo se a reunião for recusada depois).
  await db.from('reunioes_sdr_travas')
    .update({ reuniao_id: reuniaoRow.id })
    .eq('empresa_id', empresaId)
    .in('socia_id', sociaIds)
    .eq('data_inicio', inicio)

  // 10) Atividade no negócio, se veio negocio_id válido — mesmo padrão do /ingest.
  if (negocioId) {
    const { error: errAtiv } = await db.from('atividades').insert({
      empresa_id: empresaId,
      negocio_id: negocioId,
      cliente_id: clienteId,
      responsavel_id: organizadora.id,
      tipo: 'reuniao',
      descricao: `Reunião de diagnóstico agendada via Leila (SDR) — ${input.tipo === 'video' ? 'vídeo' : 'presencial'}, ${formatarSlotPtBr(inicio)}.`,
      data_atividade: inicio.slice(0, 10),
    })
    if (errAtiv) {
      console.error('[reuniao] falha ao registrar atividade (não bloqueia):', errAtiv.message)
    }
  }

  return NextResponse.json(
    {
      ok: true,
      reuniao_id: reuniaoRow.id,
      tipo: input.tipo,
      inicio,
      fim,
      meet_link: eventoGoogle.meetLink ?? null,
      socias: socias.map((s) => ({ id: s.id, nome: s.full_name })),
    },
    { status: 201 },
  )
}
