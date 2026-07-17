'use server'

import { getAuthUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteCalendarEvent } from '@/lib/google/calendar'
import { formatarSlotPtBr } from '@/lib/sdr-agenda'

/**
 * Server actions do popup de confirmação de reunião (agendamento real da
 * Leila — spec .claude/specs/sdr-agendamento-real.md). `reunioes_sdr` não tem
 * RLS permissiva (mesmo padrão de conversations/messages do app-sdr) — toda
 * leitura/escrita passa pelo admin client, com empresa_id e `confirmantes`
 * checados aqui (AC11).
 */

export interface ReuniaoPendente {
  id: string
  tipo: 'video' | 'presencial'
  data_inicio: string
  data_fim: string
  lead_nome: string
  lead_telefone: string
  lead_email: string | null
  meet_link: string | null
}

/**
 * Reuniões pendentes atribuídas ao usuário logado (AC6) — `user.id = any(confirmantes)`.
 * Lança em erro (não devolve []) — quem chama via polling precisa distinguir
 * "falhou, mantenha o valor anterior" de "de fato zero pendências" (mesmo
 * padrão de contarConversasNaoLidas em atendimento/atendimento-actions.ts).
 */
export async function listarReunioesPendentes(): Promise<ReuniaoPendente[]> {
  const { user, empresaId } = await getAuthUser()
  if (!empresaId) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reunioes_sdr')
    .select('id, tipo, data_inicio, data_fim, lead_nome, lead_telefone, lead_email, meet_link')
    .eq('empresa_id', empresaId)
    .eq('status', 'pendente')
    .contains('confirmantes', [user.id])
    .order('data_inicio', { ascending: true })

  if (error) {
    console.error('[reunioes-sdr] erro ao listar pendentes:', error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as ReuniaoPendente[]
}

function montarMensagemConfirmacao(r: { tipo: string; data_inicio: string; meet_link: string | null }): string {
  const quando = formatarSlotPtBr(r.data_inicio)
  if (r.tipo === 'video' && r.meet_link) {
    return `Combinado! Sua conversa de diagnóstico está confirmada para ${quando}, por vídeo. Link da chamada: ${r.meet_link}`
  }
  return `Combinado! Sua conversa de diagnóstico está confirmada para ${quando}${r.tipo === 'presencial' ? ', presencial, no nosso escritório' : ''}.`
}

/**
 * Mesmo padrão de responderConversa em atendimento/atendimento-actions.ts.
 * `manterBot`: essa mensagem é automática (do próprio sistema, não de um humano
 * assumindo a conversa no Atendimento) — o endpoint /enviar do app-sdr, por padrão,
 * muda o status da conversa pra 'humano' como efeito colateral (pensado pro caso de
 * atendente humano). Default false preserva o comportamento atual (usado por
 * confirmarReuniao, onde virar 'humano' após confirmado é aceitável); recusarReuniao
 * passa true porque ali a Leila precisa continuar ativa pra reoferecer horário.
 */
async function notificarLead(
  conversationId: string,
  texto: string,
  manterBot = false,
): Promise<{ ok: boolean; erro?: string }> {
  const url = process.env.SDR_CHAT_API_URL
  const key = process.env.SDR_CHAT_API_KEY
  if (!url || !key) return { ok: false, erro: 'Integração de envio não configurada.' }
  try {
    const res = await fetch(`${url}/api/chat/conversas/${conversationId}/enviar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, manterBot }),
    })
    if (!res.ok) {
      const corpo = await res.text().catch(() => '')
      return { ok: false, erro: `Falha ao enviar (${res.status}). ${corpo}`.trim() }
    }
    return { ok: true }
  } catch {
    return { ok: false, erro: 'Não foi possível enviar a mensagem agora.' }
  }
}

interface ResultadoAcao {
  error?: string
  jaResolvida?: boolean
  avisoEnvioFalhou?: boolean
}

/** Busca quem resolveu a pendência, pra uma mensagem clara em vez de erro genérico (AC7). */
async function nomeDeQuemResolveu(
  admin: ReturnType<typeof createAdminClient>,
  confirmadoPor: string | null,
): Promise<string> {
  if (!confirmadoPor) return 'outra pessoa'
  const { data: p } = await admin.from('profiles').select('full_name').eq('id', confirmadoPor).maybeSingle()
  return p?.full_name ?? 'outra pessoa'
}

/**
 * Confirma a reunião — UPDATE condicional (`.eq('status','pendente')`) como
 * trava anti-corrida (AC7): se 0 linhas forem afetadas, outra sócia já
 * resolveu a pendência nesse meio-tempo, e devolvemos isso explicitamente
 * (não um erro genérico). A reunião some do popup de QUALQUER sócia dos
 * confirmantes (AC8) porque o popup lista por status='pendente' — que já
 * deixou de ser verdade assim que uma das duas UPDATEs ganha a corrida.
 */
export async function confirmarReuniao(id: string): Promise<ResultadoAcao> {
  const { user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const admin = createAdminClient()

  const { data: reuniao } = await admin
    .from('reunioes_sdr')
    .select('id, confirmantes, conversation_id, tipo, meet_link, data_inicio')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!reuniao) return { error: 'Reunião não encontrada.' }
  if (!((reuniao.confirmantes as string[] | null) ?? []).includes(user.id)) {
    return { error: 'Você não está entre os confirmantes desta reunião.' }
  }

  const { data: atualizada, error } = await admin
    .from('reunioes_sdr')
    .update({ status: 'confirmada', confirmado_por: user.id, confirmado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pendente') // trava anti-corrida — nunca ler-depois-escrever
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }

  if (!atualizada) {
    const { data: atual } = await admin.from('reunioes_sdr').select('status, confirmado_por').eq('id', id).maybeSingle()
    const quem = await nomeDeQuemResolveu(admin, (atual?.confirmado_por as string | null) ?? null)
    return {
      jaResolvida: true,
      error: atual?.status === 'recusada'
        ? `Esta reunião já foi recusada por ${quem}.`
        : `Esta reunião já foi confirmada por ${quem}.`,
    }
  }

  const texto = montarMensagemConfirmacao(reuniao as { tipo: string; data_inicio: string; meet_link: string | null })
  const envio = await notificarLead(reuniao.conversation_id as string, texto)

  return envio.ok ? {} : { avisoEnvioFalhou: true }
}

/**
 * Recusa a reunião — mesma trava condicional do confirmar. Cancela o evento
 * no Google (tokens do ORGANIZADOR, resolvido via calendario_eventos — nem
 * sempre é quem está recusando), libera a trava do slot (AC10: volta a
 * aparecer como livre em /disponibilidade) e avisa o lead.
 */
export async function recusarReuniao(id: string): Promise<ResultadoAcao> {
  const { user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const admin = createAdminClient()

  const { data: reuniao } = await admin
    .from('reunioes_sdr')
    .select('id, confirmantes, conversation_id, google_event_id')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!reuniao) return { error: 'Reunião não encontrada.' }
  if (!((reuniao.confirmantes as string[] | null) ?? []).includes(user.id)) {
    return { error: 'Você não está entre os confirmantes desta reunião.' }
  }

  const { data: atualizada, error } = await admin
    .from('reunioes_sdr')
    .update({ status: 'recusada', confirmado_por: user.id, confirmado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pendente') // trava anti-corrida
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }

  if (!atualizada) {
    const { data: atual } = await admin.from('reunioes_sdr').select('status, confirmado_por').eq('id', id).maybeSingle()
    const quem = await nomeDeQuemResolveu(admin, (atual?.confirmado_por as string | null) ?? null)
    return {
      jaResolvida: true,
      error: atual?.status === 'confirmada'
        ? `Esta reunião já foi confirmada por ${quem}.`
        : `Esta reunião já foi recusada por ${quem}.`,
    }
  }

  const googleEventId = reuniao.google_event_id as string
  const { data: eventoRegistrado } = await admin
    .from('calendario_eventos')
    .select('organizer_user_id')
    .eq('event_id', googleEventId)
    .maybeSingle()

  if (eventoRegistrado?.organizer_user_id) {
    const { data: organizerProfile } = await admin
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expiry')
      .eq('id', eventoRegistrado.organizer_user_id)
      .maybeSingle()
    if (organizerProfile?.google_refresh_token) {
      try {
        await deleteCalendarEvent({
          userId: eventoRegistrado.organizer_user_id as string,
          accessToken: organizerProfile.google_access_token ?? '',
          refreshToken: organizerProfile.google_refresh_token,
          tokenExpiry: organizerProfile.google_token_expiry ?? new Date(0).toISOString(),
          eventId: googleEventId,
        })
      } catch (err) {
        // Best-effort: não bloqueia a recusa por falha ao cancelar no Google
        // (ex.: sócia revogou o acesso) — o registro local já reflete a recusa.
        console.error('[reunioes-sdr] falha ao cancelar evento no Google:', err)
      }
    }
  }
  await admin.from('calendario_eventos').delete().eq('event_id', googleEventId)

  // Libera a trava do slot — volta a aparecer como livre em /disponibilidade.
  await admin.from('reunioes_sdr_travas').delete().eq('reuniao_id', id)

  const texto =
    'Poxa, esse horário acabou não dando certo pra equipe. Vamos achar outro — me diz um período que ' +
    'funciona melhor pra você que eu já confiro a agenda de novo.'
  const envio = await notificarLead(reuniao.conversation_id as string, texto, true)

  // Reabre a etapa de agendamento e garante status='bot'/ia_ativa=true explicitamente
  // (defesa em profundidade: manterBot:true já pede isso ao app-sdr, mas são dois
  // repos/sistemas diferentes — não confiamos só no lado de lá). Best-effort, não
  // bloqueia a recusa se falhar.
  await admin
    .from('conversations')
    .update({ status: 'bot', ia_ativa: true, etapa: 'agendamento' })
    .eq('id', reuniao.conversation_id as string)

  return envio.ok ? {} : { avisoEnvioFalhou: true }
}
