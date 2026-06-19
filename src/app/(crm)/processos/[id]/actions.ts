'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createEvent } from '@/lib/google-calendar'

const STATUS_VALIDOS = ['ativo', 'encerrado', 'suspenso', 'arquivado']

export async function atualizarStatusProcesso(
  processoId: string,
  status: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!STATUS_VALIDOS.includes(status)) return { error: 'Status inválido.' }

  const { data, error } = await supabase
    .from('processos_juridicos')
    .update({ status })
    .eq('id', processoId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Você não tem permissão para alterar este processo.' }

  revalidatePath(`/processos/${processoId}`)
  revalidatePath('/processos')
  return {}
}

export async function deletarProcesso(processoId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // RLS só permite admin excluir; se não excluir nenhuma linha, sem permissão.
  const { data, error } = await supabase
    .from('processos_juridicos')
    .delete()
    .eq('id', processoId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Apenas administradores podem excluir processos.' }

  revalidatePath('/processos')
  redirect('/processos')
}

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
      // Client autenticado: o trigger set_empresa_id carimba empresa_id a partir
      // do contexto do usuário (o admin client rodaria sem sessão → trigger falha).
      const { error: errReg } = await supabase.from('calendario_eventos').insert({
        event_id:          eventData.id,
        calendar_id:       calendarId,
        organizer_email:   user.email ?? '',
        organizer_user_id: user.id,
        titulo,
      })
      if (errReg) {
        console.error('[processos] evento criado no Google mas falhou ao registrar localmente:', errReg.message)
        return { error: 'Evento criado no Google Agenda, mas não foi possível registrá-lo no sistema.' }
      }
    }

    revalidatePath('/calendario')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao criar evento no calendário.' }
  }
}
