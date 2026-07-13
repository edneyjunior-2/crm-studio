import { createAdminClient } from '@/lib/supabase/admin'
import { listGoogleCalendarEvents } from './calendar'

export interface SincronizarResultado {
  ok: boolean
  importados: number
  atualizados: number
  removidos: number
  erro?: string
}

/**
 * Sincroniza o calendário 'primary' do Google de um usuário para
 * calendario_eventos. Chamada tanto pelo cron periódico quanto pelo callback
 * OAuth (sync inicial ao conectar) — mesma lógica, sem duplicação.
 *
 * Nunca insere/atualiza/remove linhas com origem='crm' (eventos criados pelo
 * próprio CRM, geridos só pelas actions de calendário/processos/pipeline).
 */
export async function sincronizarCalendarioUsuario(profileId: string): Promise<SincronizarResultado> {
  const admin = createAdminClient()

  const { data: profile, error: errProfile } = await admin
    .from('profiles')
    .select('id, empresa_id, google_access_token, google_refresh_token, google_token_expiry, google_calendar_sync_token')
    .eq('id', profileId)
    .single()

  if (errProfile || !profile?.google_refresh_token) {
    return { ok: false, importados: 0, atualizados: 0, removidos: 0, erro: 'Perfil sem Google Calendar conectado.' }
  }
  if (!profile.empresa_id) {
    return { ok: false, importados: 0, atualizados: 0, removidos: 0, erro: 'Perfil sem empresa vinculada.' }
  }

  const { data: authRow } = await admin
    .from('profiles_auth')
    .select('email')
    .eq('id', profileId)
    .maybeSingle()
  const organizerEmail = (authRow?.email as string | undefined) ?? ''

  const auth = {
    userId: profile.id as string,
    accessToken: (profile.google_access_token as string | null) ?? '',
    refreshToken: profile.google_refresh_token as string,
    tokenExpiry: (profile.google_token_expiry as string | null) ?? new Date(0).toISOString(),
  }

  let resultado = await listGoogleCalendarEvents({ ...auth, syncToken: profile.google_calendar_sync_token as string | null })

  if (!resultado.ok) {
    // syncToken expirado (410) — limpa e refaz full sync na mesma passada.
    await admin.from('profiles').update({ google_calendar_sync_token: null }).eq('id', profileId)
    resultado = await listGoogleCalendarEvents({ ...auth, syncToken: null })
    if (!resultado.ok) {
      return { ok: false, importados: 0, atualizados: 0, removidos: 0, erro: 'syncToken inválido mesmo após resync completo.' }
    }
  }

  let importados = 0
  let atualizados = 0
  let removidos = 0

  for (const evento of resultado.events) {
    const eventId = evento.id
    if (!eventId) continue

    const { data: existente } = await admin
      .from('calendario_eventos')
      .select('id, origem')
      .eq('event_id', eventId)
      .maybeSingle()

    // Evento nativo do CRM — intocável pelo poller, mesmo se o Google reportar cancelamento.
    if (existente?.origem === 'crm') continue

    if (evento.status === 'cancelled') {
      if (existente) {
        await admin.from('calendario_eventos').delete().eq('id', existente.id)
        removidos++
      }
      continue
    }

    const dataInicio = evento.start?.dateTime ?? (evento.start?.date ? `${evento.start.date}T00:00:00Z` : null)
    const dataFim = evento.end?.dateTime ?? (evento.end?.date ? `${evento.end.date}T00:00:00Z` : null)
    if (!dataInicio || !dataFim) continue // sem data válida do Google, não persiste

    const titulo = evento.summary?.trim() || '(Sem título)'
    const descricao = evento.description ?? null

    if (existente) {
      await admin
        .from('calendario_eventos')
        .update({ titulo, descricao, data_inicio: dataInicio, data_fim: dataFim })
        .eq('id', existente.id)
      atualizados++
    } else {
      await admin.from('calendario_eventos').insert({
        event_id: eventId,
        calendar_id: 'primary',
        organizer_email: organizerEmail,
        organizer_user_id: profile.id,
        titulo,
        empresa_id: profile.empresa_id,
        descricao,
        data_inicio: dataInicio,
        data_fim: dataFim,
        visivel_equipe: false,
        origem: 'google_import',
      })
      importados++
    }
  }

  await admin
    .from('profiles')
    .update({
      google_calendar_sync_token: resultado.nextSyncToken,
      google_calendar_last_synced_at: new Date().toISOString(),
    })
    .eq('id', profileId)

  return { ok: true, importados, atualizados, removidos }
}
