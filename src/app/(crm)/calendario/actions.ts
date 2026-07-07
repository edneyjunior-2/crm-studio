'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'
import { createEvent, deleteEvent, updateEvent, CALENDAR_ID } from '@/lib/google-calendar'

export async function criarEvento(formData: FormData) {
  const { user, empresaId, role } = await getAuthUser()
  if (role === 'parceiro') return { error: 'Acesso negado.' }
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const start = formData.get('start') as string
  const end = formData.get('end') as string
  const attendeesRaw = formData.get('attendees') as string
  const externalLink = (formData.get('external_link') as string)?.trim() || undefined
  const recurrenceRaw = (formData.get('recurrence') as string)?.trim() || null
  const recurrence = (recurrenceRaw === 'semanal' || recurrenceRaw === 'mensal' || recurrenceRaw === 'anual')
    ? recurrenceRaw
    : null

  if (!title || !start || !end) return { error: 'Preencha todos os campos obrigatórios' }

  // Garante que o fim é posterior ao início
  if (new Date(end) <= new Date(start)) {
    return { error: 'A data/hora de fim deve ser posterior ao início' }
  }

  const attendees = attendeesRaw
    ? attendeesRaw
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
    : []

  try {
    // organizerEmail: impersona o usuário logado via DWD para que o convite
    // do Meet saia do e-mail dele, não do e-mail padrão da service account.
    // Requer que o e-mail do usuário esteja no mesmo Google Workspace com DWD configurado.
    const { eventData, calendarId: calendarIdUsado } = await createEvent({
      title, description, start, end, attendees, externalLink,
      organizerEmail: user.email ?? undefined,
      recurrence: recurrence ?? undefined,
    })

    // Registrar evento na tabela de tracking para habilitar edição e notificações
    if (eventData.id) {
      const admin = createAdminClient()
      const { error: insertErr } = await admin.from('calendario_eventos').insert({
        event_id: eventData.id,
        calendar_id: calendarIdUsado,
        organizer_email: user.email ?? '',
        organizer_user_id: user.id,
        titulo: title,
        empresa_id: empresaId,
      })
      if (insertErr) {
        // O evento já foi criado no Google — tenta remover para não deixar órfão.
        try {
          await deleteEvent(calendarIdUsado, eventData.id, user.email ?? undefined)
        } catch {
          // Best-effort: ignora falha na remoção, mas o erro principal é surfaçado.
        }
        return { error: `Evento criado no Google, mas falhou ao registrar localmente: ${insertErr.message}` }
      }
    }

    // Salvar e-mails externos novos para autocomplete futuro
    if (attendees.length > 0) {
      const admin = createAdminClient()
      // E-mail vem da view profiles_auth (banco, via service_role), NÃO de
      // auth.admin.listUsers() (GoTrue) — que falha/retorna vazio em prod.
      const { data: internos } = await admin.from('profiles_auth').select('email')
      const emailsInternos = new Set((internos ?? []).map((u) => u.email))
      const externos = attendees.filter((e) => !emailsInternos.has(e))
      if (externos.length > 0) {
        await admin
          .from('calendario_contatos')
          .upsert(externos.map((email) => ({ email, empresa_id: empresaId })), { onConflict: 'empresa_id,email', ignoreDuplicates: true })
      }
    }

    revalidatePath('/calendario')
    return {
      success: true,
      meetLink: eventData.conferenceData?.entryPoints?.[0]?.uri,
      eventId: eventData.id,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao criar evento' }
  }
}

export async function editarEvento(
  eventId: string,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const { user, empresaId, role } = await getAuthUser()
  if (role === 'parceiro') return { error: 'Acesso negado.' }
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || ''
  const start = formData.get('start') as string
  const end = formData.get('end') as string
  const attendeesRaw = (formData.get('attendees') as string) ?? ''
  const externalLink = (formData.get('external_link') as string)?.trim() || undefined

  const tituloAnterior = (formData.get('titulo_anterior') as string) ?? ''
  const horarioInicioAnterior = (formData.get('horario_inicio_anterior') as string) ?? ''
  const horarioFimAnterior = (formData.get('horario_fim_anterior') as string) ?? ''

  if (!title || !start || !end) return { error: 'Preencha todos os campos obrigatórios' }
  if (new Date(end) <= new Date(start)) return { error: 'A data/hora de fim deve ser posterior ao início' }

  const attendees = attendeesRaw
    ? attendeesRaw.split(',').map((e) => e.trim()).filter(Boolean)
    : []

  const admin = createAdminClient()

  // Buscar registro do evento no banco
  const { data: eventoRegistrado } = await admin
    .from('calendario_eventos')
    .select('calendar_id, organizer_user_id, organizer_email, titulo')
    .eq('event_id', eventId)
    .single()

  // Autorização: só o organizador pode editar o evento. As tabelas de calendário
  // têm RLS USING(true), então sem este check qualquer autenticado com o event_id
  // poderia editar eventos de outros usuários/tenants.
  if (!eventoRegistrado || eventoRegistrado.organizer_user_id !== user.id) {
    return { error: 'Evento não encontrado ou sem permissão' }
  }

  const calendarId = eventoRegistrado.calendar_id ?? CALENDAR_ID
  const organizerEmail = eventoRegistrado.organizer_email ?? undefined
  const organizerUserId = eventoRegistrado.organizer_user_id ?? null

  try {
    await updateEvent(calendarId, eventId, {
      title, description, start, end, attendees, externalLink,
    }, organizerEmail)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao atualizar evento no Google Calendar' }
  }

  // Detectar campos alterados e gerar notificações para o organizador (se não for o editor)
  const editorId = user.id
  const ehOrganizador = editorId === organizerUserId

  if (!ehOrganizador && organizerUserId) {
    // Buscar nome do editor
    const { data: editorProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', editorId)
      .single()
    const editorNome = editorProfile?.full_name ?? user.email ?? 'Alguém'

    const notificacoes: Array<{
      event_id: string
      event_title: string
      changed_by_user_id: string
      changed_by_nome: string
      notified_user_id: string
      campo: string
      valor_anterior: string | null
      valor_novo: string | null
    }> = []

    const tituloAtual = eventoRegistrado?.titulo ?? tituloAnterior

    if (title !== tituloAnterior) {
      notificacoes.push({
        event_id: eventId,
        event_title: tituloAtual,
        changed_by_user_id: editorId,
        changed_by_nome: editorNome,
        notified_user_id: organizerUserId,
        campo: 'titulo',
        valor_anterior: tituloAnterior,
        valor_novo: title,
      })
    }

    if (start !== horarioInicioAnterior || end !== horarioFimAnterior) {
      notificacoes.push({
        event_id: eventId,
        event_title: tituloAtual,
        changed_by_user_id: editorId,
        changed_by_nome: editorNome,
        notified_user_id: organizerUserId,
        campo: 'horario',
        valor_anterior: `${horarioInicioAnterior}|${horarioFimAnterior}`,
        valor_novo: `${start}|${end}`,
      })
    }

    if (description !== (formData.get('descricao_anterior') as string ?? '')) {
      notificacoes.push({
        event_id: eventId,
        event_title: tituloAtual,
        changed_by_user_id: editorId,
        changed_by_nome: editorNome,
        notified_user_id: organizerUserId,
        campo: 'descricao',
        valor_anterior: null,
        valor_novo: null,
      })
    }

    const attendeesAnteriorRaw = (formData.get('attendees_anterior') as string) ?? ''
    const attendeesAnterior = attendeesAnteriorRaw
      ? attendeesAnteriorRaw.split(',').map((e) => e.trim()).filter(Boolean).sort().join(',')
      : ''
    const attendeesNovos = attendees.slice().sort().join(',')
    if (attendeesNovos !== attendeesAnterior) {
      notificacoes.push({
        event_id: eventId,
        event_title: tituloAtual,
        changed_by_user_id: editorId,
        changed_by_nome: editorNome,
        notified_user_id: organizerUserId,
        campo: 'participantes',
        valor_anterior: null,
        valor_novo: null,
      })
    }

    if (notificacoes.length > 0) {
      await admin.from('calendario_notificacoes').insert(
        notificacoes.map((n) => ({ ...n, empresa_id: empresaId })),
      )
    }
  }

  // Atualizar título na tabela de tracking se mudou
  if (eventoRegistrado && title !== eventoRegistrado.titulo) {
    await admin
      .from('calendario_eventos')
      .update({ titulo: title })
      .eq('event_id', eventId)
  }

  // Salvar e-mails externos novos
  if (attendees.length > 0) {
    // E-mail vem da view profiles_auth (banco, via service_role), NÃO de
    // auth.admin.listUsers() (GoTrue) — que falha/retorna vazio em prod.
    const { data: internos } = await admin.from('profiles_auth').select('email')
    const emailsInternos = new Set((internos ?? []).map((u) => u.email))
    const externos = attendees.filter((e) => !emailsInternos.has(e))
    if (externos.length > 0) {
      const { error: contatosError } = await admin
        .from('calendario_contatos')
        .upsert(
          externos.map((email) => ({ email, empresa_id: empresaId })),
          { onConflict: 'empresa_id,email', ignoreDuplicates: true },
        )
      if (contatosError) {
        console.error('Erro ao salvar contatos externos do calendário:', contatosError)
      }
    }
  }

  revalidatePath('/calendario')
  return { success: true }
}

export async function marcarNotificacoesVistas(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('calendario_notificacoes')
    .update({ seen: true })
    .eq('notified_user_id', user.id)
    .eq('seen', false)

  if (error) return { error: error.message }
  return { success: true }
}

export async function excluirEvento(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const admin = createAdminClient()

  const { data: perfil } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (perfil?.role === 'parceiro') return { error: 'Acesso negado.' }

  const { data: eventoRegistrado } = await admin
    .from('calendario_eventos')
    .select('calendar_id, organizer_email, organizer_user_id')
    .eq('event_id', eventId)
    .single()

  // Autorização: só o organizador pode excluir. Sem registro próprio, recusa —
  // as tabelas têm RLS USING(true) e o fallback legado por força-bruta permitia
  // excluir eventos de qualquer usuário/tenant que se soubesse o event_id.
  if (!eventoRegistrado || eventoRegistrado.organizer_user_id !== user.id) {
    return { error: 'Evento não encontrado ou sem permissão' }
  }

  try {
    await deleteEvent(eventoRegistrado.calendar_id, eventId, eventoRegistrado.organizer_email)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao excluir evento' }
  }
  await admin.from('calendario_eventos').delete().eq('event_id', eventId)
  revalidatePath('/calendario')
  return { success: true }
}

export async function criarBloqueio(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const { user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const titulo = (formData.get('titulo') as string)?.trim()
  const descricao = (formData.get('descricao') as string)?.trim() || null
  const dataInicio = formData.get('data') as string
  const hora_inicio = formData.get('hora_inicio') as string
  const hora_fim = formData.get('hora_fim') as string
  const recorrenciaRaw = (formData.get('recorrencia') as string)?.trim() || 'none'

  if (!titulo || !dataInicio || !hora_inicio || !hora_fim) {
    return { error: 'Preencha todos os campos obrigatórios' }
  }

  if (hora_fim <= hora_inicio) {
    return { error: 'O horário de fim deve ser posterior ao início' }
  }

  // Gera lista de datas: recorrência semanal (26x) ou mensal (12x) ou única
  const datas: string[] = []
  if (recorrenciaRaw === 'semanal') {
    const [y, m, d] = dataInicio.split('-').map(Number)
    const base = new Date(y, m - 1, d)
    for (let i = 0; i < 26; i++) {
      const dt = new Date(base)
      dt.setDate(base.getDate() + i * 7)
      datas.push(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
      )
    }
  } else if (recorrenciaRaw === 'mensal') {
    const [y, m, d] = dataInicio.split('-').map(Number)
    for (let i = 0; i < 12; i++) {
      const dt = new Date(y, m - 1 + i, d)
      datas.push(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
      )
    }
  } else {
    datas.push(dataInicio)
  }

  const registros = datas.map((data) => ({
    user_id: user.id,
    empresa_id: empresaId,
    titulo,
    descricao,
    data,
    hora_inicio,
    hora_fim,
  }))

  const supabase = await createClient()
  const { error } = await supabase.from('agenda_bloqueios').insert(registros)

  if (error) return { error: error.message }

  revalidatePath('/calendario')
  return { success: true }
}

export async function salvarNota(
  eventId: string,
  eventTitle: string,
  texto: string,
): Promise<{ error?: string; success?: boolean }> {
  const { user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const supabase = await createClient()
  const { error } = await supabase.from('calendario_notas').upsert(
    {
      event_id: eventId,
      event_title: eventTitle,
      texto,
      empresa_id: empresaId,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  )

  if (error) return { error: error.message }
  return { success: true }
}

export async function excluirBloqueio(id: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('agenda_bloqueios')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/calendario')
  return { success: true }
}
