'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createEvent } from '@/lib/google-calendar'

export async function marcarComoLido(processoId: string) {
  const supabase = await createClient()
  await supabase
    .from('movimentacoes_processo')
    .update({ lido: true })
    .eq('processo_id', processoId)
    .eq('lido', false)

  revalidatePath(`/processos/${processoId}`)
  revalidatePath('/processos')
}

export interface AdicionarAudienciaResult {
  error?:   string
  success?: boolean
}

export async function adicionarAudienciaAoCalendario(
  descricao: string,
  dataHora:  string,
  processoNumero: string,
): Promise<AdicionarAudienciaResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // dataHora vem do DataJud em ISO: "2024-06-20T14:00:00.000Z"
  const inicio = new Date(dataHora)
  const fim    = new Date(inicio.getTime() + 60 * 60 * 1000) // +1h

  const isoInicio = inicio.toISOString()
  const isoFim    = fim.toISOString()

  const titulo = `Audiência — Processo ${processoNumero}`
  const descFull = `${descricao}\n\nProcesso: ${processoNumero}`

  try {
    const { eventData, calendarId } = await createEvent({
      title:          titulo,
      description:    descFull,
      start:          isoInicio,
      end:            isoFim,
      attendees:      [],
      organizerEmail: user.email ?? undefined,
    })

    if (eventData.id) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      await admin.from('calendario_eventos').insert({
        event_id:          eventData.id,
        calendar_id:       calendarId,
        organizer_email:   user.email ?? '',
        organizer_user_id: user.id,
        titulo,
      })
    }

    revalidatePath('/calendario')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao criar evento no calendário.' }
  }
}
