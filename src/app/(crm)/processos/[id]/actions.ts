'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createEvent } from '@/lib/google-calendar'
import { parseValorBR } from '@/lib/honorarios'

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

export interface EditarProcessoState { error?: string }

export async function atualizarProcesso(
  _prev: EditarProcessoState | null,
  formData: FormData,
): Promise<EditarProcessoState | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const processoId = (formData.get('processo_id') as string)?.trim()
  if (!processoId) return { error: 'Processo inválido.' }

  const clienteId  = (formData.get('cliente_id') as string)?.trim() || null
  const advogadoId = (formData.get('advogado_id') as string)?.trim() || null
  const area       = (formData.get('area') as string)?.trim() || null
  const assunto    = (formData.get('assunto') as string)?.trim() || null
  const vara       = (formData.get('vara') as string)?.trim() || null
  const comarca    = (formData.get('comarca') as string)?.trim() || null
  const valorRaw   = (formData.get('valor_causa') as string)?.trim()
  const valorNum   = valorRaw ? parseValorBR(valorRaw) : null
  const valor      = valorNum != null && !Number.isNaN(valorNum) ? valorNum : null

  const honTipoRaw  = (formData.get('honorarios_tipo') as string)?.trim()
  const honTipo     = honTipoRaw === 'fixo' || honTipoRaw === 'percentual' ? honTipoRaw : null
  const honValorRaw = (formData.get('honorarios_valor') as string)?.trim()
  const honValorNum = honValorRaw ? parseFloat(honValorRaw.replace(',', '.')) : null
  const honValor    = honTipo && honValorNum != null && !Number.isNaN(honValorNum) ? honValorNum : null

  const { data, error } = await supabase
    .from('processos_juridicos')
    .update({
      cliente_id:       clienteId,
      advogado_id:      advogadoId,
      area,
      assunto,
      vara,
      comarca,
      valor_causa:      valor,
      honorarios_tipo:  honTipo,
      honorarios_valor: honValor,
    })
    .eq('id', processoId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Você não tem permissão para editar este processo.' }

  revalidatePath(`/processos/${processoId}`)
  redirect(`/processos/${processoId}`)
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
  meetLink?: string
}

export interface AgendarAudienciaPayload {
  titulo:          string
  dataHoraInicio:  string  // ISO com fuso (ex: "2026-06-25T09:00:00-03:00")
  duracaoMinutos:  number  // 30 | 60 | 90 | 120
  local:           string
  descricao:       string  // detalhes do processo (número, cliente, área)
  attendeeEmails:  string[]
}

export async function agendarAudienciaNoCalendario(
  payload: AgendarAudienciaPayload,
): Promise<AdicionarAudienciaResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const inicio = new Date(payload.dataHoraInicio)
  const fim    = new Date(inicio.getTime() + payload.duracaoMinutos * 60 * 1000)

  try {
    const { eventData, calendarId } = await createEvent({
      title:          payload.titulo,
      description:    payload.descricao,
      start:          inicio.toISOString(),
      end:            fim.toISOString(),
      attendees:      payload.attendeeEmails,
      organizerEmail: user.email ?? undefined,
      location:       payload.local || undefined,
    })

    if (eventData.id) {
      const { error: errReg } = await supabase.from('calendario_eventos').insert({
        event_id:          eventData.id,
        calendar_id:       calendarId,
        organizer_email:   user.email ?? '',
        organizer_user_id: user.id,
        titulo:            payload.titulo,
      })
      if (errReg) {
        console.error('[processos] evento criado no Google mas falhou ao registrar localmente:', errReg.message)
        return { error: 'Evento criado no Google Agenda, mas não foi possível registrá-lo no sistema.' }
      }
    }

    revalidatePath('/calendario')
    return {
      success:  true,
      meetLink: eventData.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao criar evento no calendário.' }
  }
}
