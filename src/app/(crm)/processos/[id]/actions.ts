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
  const valorNum   = valorRaw ? parseFloat(valorRaw.replace(',', '.')) : null
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
