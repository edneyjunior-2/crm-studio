'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/google/calendar'

export async function criarEvento(formData: FormData) {
  const { user, empresaId, role } = await getAuthUser()
  if (role === 'parceiro') return { error: 'Acesso negado.' }
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const title = formData.get('title') as string
  const descricaoForm = (formData.get('description') as string) ?? ''
  const start = formData.get('start') as string
  const end = formData.get('end') as string
  const attendeesRaw = formData.get('attendees') as string
  const externalLink = (formData.get('external_link') as string)?.trim() || undefined
  const visivelEquipe = (formData.get('visivel_equipe') as string) === 'true'

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

  // Schema não tem coluna própria pro link externo (Zoom/Teams) — concatena de
  // forma legível na descrição (ponytail, evita migration nova).
  const descricao = externalLink ? `${descricaoForm}\n\nLink: ${externalLink}`.trim() : descricaoForm

  // Inputs do form vêm como "YYYY-MM-DDTHH:MM:00" (hora local implícita, sem
  // offset) — adiciona o offset explícito de São Paulo antes de ir pro Google/banco.
  const startISO = `${start}-03:00`
  const endISO = `${end}-03:00`

  const admin = createAdminClient()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', user.id)
    .single()

  let eventId: string
  let calendarIdUsado: string | null = null
  let meetLink: string | undefined

  if (!profile?.google_refresh_token) {
    // Usuário não conectou o Google — evento existe só no CRM.
    eventId = crypto.randomUUID()
  } else {
    try {
      const result = await createCalendarEvent({
        userId: user.id,
        accessToken: profile.google_access_token ?? '',
        refreshToken: profile.google_refresh_token,
        tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
        title,
        description: descricao,
        startDateTime: startISO,
        endDateTime: endISO,
        attendeeEmails: attendees,
        createMeet: !externalLink,
        externalLink,
      })
      eventId = result.eventId
      calendarIdUsado = 'primary'
      meetLink = result.meetLink
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      return {
        error: `A conexão com o Google Calendar expirou ou foi revogada. Reconecte sua conta em /minha-conta. (${message})`,
      }
    }
  }

  // Registrar evento na tabela de tracking para habilitar edição e notificações
  const { error: insertErr } = await admin.from('calendario_eventos').insert({
    event_id: eventId,
    calendar_id: calendarIdUsado,
    organizer_email: user.email ?? '',
    organizer_user_id: user.id,
    titulo: title,
    empresa_id: empresaId,
    descricao,
    data_inicio: startISO,
    data_fim: endISO,
    visivel_equipe: visivelEquipe,
    meet_link: meetLink ?? null,
  })

  if (insertErr) {
    // O evento já foi criado no Google — tenta remover para não deixar órfão.
    if (calendarIdUsado && profile?.google_refresh_token) {
      try {
        await deleteCalendarEvent({
          userId: user.id,
          accessToken: profile.google_access_token ?? '',
          refreshToken: profile.google_refresh_token,
          tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
          eventId,
        })
      } catch {
        // Best-effort: ignora falha na remoção, mas o erro principal é surfaçado.
      }
    }
    return { error: `Evento criado, mas falhou ao registrar localmente: ${insertErr.message}` }
  }

  // Salvar e-mails externos novos para autocomplete futuro
  if (attendees.length > 0) {
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
    meetLink,
    eventId,
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

  // Mesma regra da criação: link externo concatenado na descrição, já que o
  // schema não tem coluna própria pra ele.
  const descricao = externalLink ? `${description}\n\nLink: ${externalLink}`.trim() : description

  // Offset explícito de São Paulo — inputs do form são naive (sem offset).
  const startISO = `${start}-03:00`
  const endISO = `${end}-03:00`

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

  const organizerUserId = eventoRegistrado.organizer_user_id ?? null

  // Visibilidade não é editável aqui (decisão deliberada de escopo) — o toggle
  // "visivel_equipe" só existe na criação, não lemos/escrevemos esse campo.

  // Só sincroniza com o Google se o evento tiver calendar_id (organizador estava
  // conectado ao criar). Usa os tokens do ORGANIZADOR (eventoRegistrado.organizer_user_id),
  // não do usuário que está editando — podem ser pessoas diferentes.
  if (eventoRegistrado.calendar_id && organizerUserId) {
    const { data: organizerProfile } = await admin
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expiry')
      .eq('id', organizerUserId)
      .single()

    if (organizerProfile?.google_refresh_token) {
      try {
        await updateCalendarEvent({
          userId: organizerUserId,
          accessToken: organizerProfile.google_access_token ?? '',
          refreshToken: organizerProfile.google_refresh_token,
          tokenExpiry: organizerProfile.google_token_expiry ?? new Date(0).toISOString(),
          eventId,
          title,
          description: descricao,
          startDateTime: startISO,
          endDateTime: endISO,
          // Convidados não são persistidos localmente (ver page.tsx) — o form de
          // edição sempre abre com a lista vazia, a menos que o usuário re-adicione
          // manualmente. Só manda o campo se houver algo real, senão omite (undefined)
          // pra não apagar os convidados que já existem no evento do Google.
          attendeeEmails: attendees.length > 0 ? attendees : undefined,
          externalLink,
        })
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Erro ao atualizar evento no Google Calendar' }
      }
    }
    // Organizador desconectou o Google depois de criar o evento — segue só
    // local, sem erro pro usuário (mesma regra de "sem Google = evento só no CRM").
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

  // Sincroniza os campos locais (título/descrição/horário) com o que foi salvo
  // no Google (ou, se o evento não tem calendar_id, com o próprio input — é o
  // único lugar onde esses dados existem).
  await admin
    .from('calendario_eventos')
    .update({
      titulo: title,
      descricao,
      data_inicio: startISO,
      data_fim: endISO,
    })
    .eq('event_id', eventId)

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

  // Só chama o Google se o evento tiver calendar_id. Usa os tokens do
  // ORGANIZADOR (eventoRegistrado.organizer_user_id), não de quem está excluindo.
  if (eventoRegistrado.calendar_id && eventoRegistrado.organizer_user_id) {
    const { data: organizerProfile } = await admin
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expiry')
      .eq('id', eventoRegistrado.organizer_user_id)
      .single()

    if (organizerProfile?.google_refresh_token) {
      try {
        await deleteCalendarEvent({
          userId: eventoRegistrado.organizer_user_id,
          accessToken: organizerProfile.google_access_token ?? '',
          refreshToken: organizerProfile.google_refresh_token,
          tokenExpiry: organizerProfile.google_token_expiry ?? new Date(0).toISOString(),
          eventId,
        })
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Erro ao excluir evento' }
      }
    }
    // Organizador sem token do Google (desconectou) — não bloqueia a exclusão
    // no CRM por causa disso, trata como sucesso local.
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
