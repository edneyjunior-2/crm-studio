'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { createCalendarEvent } from '@/lib/google/calendar'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function registrarEmailComFollowups(
  negocioId: string,
  responsavelId: string,
  observacao: string,
  agendarD3: boolean,
  agendarD7: boolean
): Promise<{ error?: string }> {
  const { supabase, user } = await getUser()

  const hoje = new Date()
  const hojeStr = toDateStr(hoje)

  // cliente_id derivado do negócio → a atividade aparece também no detalhe do cliente.
  const { data: negEmail } = await supabase.from('negocios').select('cliente_id').eq('id', negocioId).single()

  // Salva a atividade de e-mail
  const { error: atividadeErr } = await supabase.from('atividades').insert({
    negocio_id: negocioId,
    cliente_id: negEmail?.cliente_id ?? null,
    responsavel_id: user.id,
    tipo: 'email',
    descricao: observacao || 'E-mail enviado ao cliente.',
    data_atividade: hojeStr,
  })
  if (atividadeErr) return { error: atividadeErr.message }

  // Agenda os follow-ups selecionados
  const followups = []
  if (agendarD3) {
    const d3 = new Date(hoje)
    d3.setDate(hoje.getDate() + 3)
    followups.push({
      negocio_id: negocioId,
      responsavel_id: responsavelId,
      tipo: 'd3',
      data_agendada: toDateStr(d3),
      status: 'pendente',
      created_by: user.id,
    })
  }
  if (agendarD7) {
    const d7 = new Date(hoje)
    d7.setDate(hoje.getDate() + 7)
    followups.push({
      negocio_id: negocioId,
      responsavel_id: responsavelId,
      tipo: 'd7',
      data_agendada: toDateStr(d7),
      status: 'pendente',
      created_by: user.id,
    })
  }

  if (followups.length > 0) {
    const { error: followupErr } = await supabase.from('followups').insert(followups)
    if (followupErr) return { error: followupErr.message }
  }

  revalidatePath('/pipeline')
  revalidatePath('/dashboard')
  return {}
}

// ── Lembrete ──────────────────────────────────────────────────────────────────

interface CriarLembreteParams {
  negocioId: string
  /** YYYY-MM-DD */
  data: string
  /** HH:MM, padrão 09:00 */
  hora?: string
  observacao?: string
  adicionarCalendario: boolean
}

interface CriarLembreteResult {
  error?: string
  googleEventUrl?: string
}

export async function criarLembrete(
  params: CriarLembreteParams
): Promise<CriarLembreteResult> {
  const { negocioId, data, hora = '09:00', observacao, adicionarCalendario } = params

  const { supabase, user, empresaId } = await getAuthUser()

  // Busca nome do cliente a partir do negócio
  const { data: negocio } = await supabase
    .from('negocios')
    .select('titulo, clientes(razao_social)')
    .eq('id', negocioId)
    .single()

  const neg = negocio as {
    titulo: string | null
    clientes: { razao_social: string | null } | { razao_social: string | null }[] | null
  } | null
  const rel = neg?.clientes
  const razaoSocial = Array.isArray(rel) ? rel[0]?.razao_social : rel?.razao_social
  const clienteNome: string = razaoSocial ?? neg?.titulo ?? 'Cliente'

  let googleEventId: string | null = null
  let googleEventUrl: string | null = null

  if (adicionarCalendario) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expiry')
      .eq('id', user.id)
      .single()

    if (!profile?.google_refresh_token) {
      return {
        error: 'Google Calendar não conectado. Acesse as Configurações para conectar.',
      }
    }

    // Calcula +30 min para o end
    const [hh, mm] = hora.split(':').map(Number)
    const endMinutes = (hh * 60 + mm + 30) % (24 * 60)
    const endHH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
    const endMM = String(endMinutes % 60).padStart(2, '0')

    const startDateTime = `${data}T${hora}:00-03:00`
    const endDateTime = `${data}T${endHH}:${endMM}:00-03:00`

    try {
      const result = await createCalendarEvent({
        userId: user.id,
        accessToken: profile.google_access_token ?? '',
        refreshToken: profile.google_refresh_token,
        tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
        title: `Lembrete: ${clienteNome}`,
        description: observacao,
        startDateTime,
        endDateTime,
      })
      googleEventId = result.eventId
      googleEventUrl = result.eventUrl
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao criar evento no Google Calendar.'
      return { error: message }
    }
  }

  const { error: insertErr } = await supabase.from('followups').insert({
    negocio_id: negocioId,
    responsavel_id: user.id,
    tipo: 'lembrete',
    data_agendada: data,
    observacao: observacao ?? null,
    status: 'pendente',
    empresa_id: empresaId,
    google_event_id: googleEventId,
    google_event_url: googleEventUrl,
    created_by: user.id,
  })

  if (insertErr) {
    return { error: insertErr.message }
  }

  revalidatePath('/pipeline')
  revalidatePath('/dashboard')

  return { googleEventUrl: googleEventUrl ?? undefined }
}

// ──────────────────────────────────────────────────────────────────────────────

export async function concluirFollowup(id: string): Promise<{ error?: string }> {
  const { supabase } = await getUser()

  const { error } = await supabase
    .from('followups')
    .update({ status: 'concluido' })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/pipeline')
  return {}
}

