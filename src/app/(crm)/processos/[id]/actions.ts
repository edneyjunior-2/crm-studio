'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { createEvent } from '@/lib/google-calendar'
import { parseValorBR } from '@/lib/honorarios'
import { PROCESSO_STATUS_VALIDOS } from '@/lib/processos-status'

export async function atualizarStatusProcesso(
  processoId: string,
  status: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!PROCESSO_STATUS_VALIDOS.includes(status)) return { error: 'Status inválido.' }

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

  // Vários clientes podem ser selecionados; o 1º vira o principal (cliente_id),
  // os demais ficam em processos_clientes (mesma convenção da criação, ver
  // .claude/specs/processos-multiplos-clientes.md).
  const clienteIds = [...new Set(formData.getAll('cliente_ids').map((v) => v.toString().trim()).filter(Boolean))]
  const clienteId  = clienteIds[0] ?? null
  const advogadoId = (formData.get('advogado_id') as string)?.trim() || null
  const advogadoIdAdicional = (formData.get('advogado_id_adicional') as string)?.trim() || null
  const parceiroId = (formData.get('parceiro_id') as string)?.trim() || null
  // Parceiro indicador (public.parceiros) — distinto de parceiroId acima (profiles/portal).
  const indicadorParceiroId = (formData.get('indicador_parceiro_id') as string)?.trim() || null
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

  const poloPassivoNome       = (formData.get('polo_passivo_nome') as string)?.trim() || null
  const poloPassivoCpfCnpj    = (formData.get('polo_passivo_cpf_cnpj') as string)?.trim() || null
  const advNomeAdvers         = (formData.get('advogado_adversario_nome') as string)?.trim() || null
  const advOabAdvers          = (formData.get('advogado_adversario_oab') as string)?.trim() || null

  const { data, error } = await supabase
    .from('processos_juridicos')
    .update({
      cliente_id:               clienteId,
      advogado_id:              advogadoId,
      parceiro_id:              parceiroId,
      indicador_parceiro_id:    indicadorParceiroId,
      area,
      assunto,
      vara,
      comarca,
      valor_causa:              valor,
      honorarios_tipo:          honTipo,
      honorarios_valor:         honValor,
      polo_passivo_nome:        poloPassivoNome,
      polo_passivo_cpf_cnpj:    poloPassivoCpfCnpj,
      advogado_adversario_nome: advNomeAdvers,
      advogado_adversario_oab:  advOabAdvers,
    })
    .eq('id', processoId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Você não tem permissão para editar este processo.' }

  // Sincroniza os clientes adicionais (2º em diante) com o que já está gravado —
  // insere só os novos, remove só os que saíram da seleção. Idempotente: reenviar
  // a mesma seleção duas vezes não gera erro nem linha duplicada.
  const clientesAdicionais = clienteIds.slice(1)
  const { data: atuais, error: errAtuais } = await supabase
    .from('processos_clientes')
    .select('cliente_id')
    .eq('processo_id', processoId)
  if (errAtuais) return { error: errAtuais.message }

  const atuaisIds = new Set((atuais ?? []).map((r) => r.cliente_id as string))
  const novosIds  = new Set(clientesAdicionais)
  const paraRemover = [...atuaisIds].filter((cid) => !novosIds.has(cid))
  const paraAdicionar = clientesAdicionais.filter((cid) => !atuaisIds.has(cid))

  if (paraRemover.length > 0) {
    const { error: errRemover } = await supabase
      .from('processos_clientes')
      .delete()
      .eq('processo_id', processoId)
      .in('cliente_id', paraRemover)
    if (errRemover) return { error: errRemover.message }
  }

  if (paraAdicionar.length > 0) {
    const { error: errAdicionar } = await supabase
      .from('processos_clientes')
      .insert(paraAdicionar.map((cliente_id) => ({ processo_id: processoId, cliente_id })))
    if (errAdicionar) return { error: errAdicionar.message }
  }

  // Sincroniza o 2º advogado responsável (opcional) com o mesmo padrão de diff
  // acima — hoje é no máximo 1 advogado adicional, não uma lista.
  const { data: advAtuais, error: errAdvAtuais } = await supabase
    .from('processos_advogados')
    .select('advogado_id')
    .eq('processo_id', processoId)
  if (errAdvAtuais) return { error: errAdvAtuais.message }

  const advAtuaisIds = new Set((advAtuais ?? []).map((r) => r.advogado_id as string))
  const advNovosIds  = new Set(advogadoIdAdicional ? [advogadoIdAdicional] : [])
  const advParaRemover = [...advAtuaisIds].filter((aid) => !advNovosIds.has(aid))
  const advParaAdicionar = [...advNovosIds].filter((aid) => !advAtuaisIds.has(aid))

  if (advParaRemover.length > 0) {
    const { error: errAdvRemover } = await supabase
      .from('processos_advogados')
      .delete()
      .eq('processo_id', processoId)
      .in('advogado_id', advParaRemover)
    if (errAdvRemover) return { error: errAdvRemover.message }
  }

  if (advParaAdicionar.length > 0) {
    const { error: errAdvAdicionar } = await supabase
      .from('processos_advogados')
      .insert(advParaAdicionar.map((advogado_id) => ({ processo_id: processoId, advogado_id })))
    if (errAdvAdicionar) return { error: errAdvAdicionar.message }
  }

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

// ---------------------------------------------------------------------------
// Movimentações internas
// ---------------------------------------------------------------------------

export async function criarMovimentacaoInterna(
  processoId: string,
  assunto: string,
  descricao?: string,
): Promise<{ error?: string }> {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!assunto.trim()) return { error: 'Assunto é obrigatório.' }

  // Verificar que o processoId pertence à empresa efetiva do usuário (guard cross-tenant)
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { data: processo } = await supabase
    .from('processos_juridicos')
    .select('id')
    .eq('id', processoId)
    .eq('empresa_id', empresaId)
    .single()

  if (!processo) return { error: 'Processo não encontrado ou sem permissão.' }

  const { error } = await supabase
    .from('movimentacoes_internas_processo')
    .insert({
      processo_id: processoId,
      autor_id:    user.id,
      assunto:     assunto.trim(),
      descricao:   descricao?.trim() || null,
    })

  if (error) return { error: error.message }

  revalidatePath(`/processos/${processoId}`)
  return {}
}

// ---------------------------------------------------------------------------
// Concluir / Reativar (sempre geram movimentação interna)
// ---------------------------------------------------------------------------

export async function concluirProcesso(
  processoId: string,
  motivo: string,
  descricao?: string,
): Promise<{ error?: string }> {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!user) return { error: 'Não autenticado.' }

  if (!empresaId) return { error: 'Empresa não encontrada.' }
  const { data: proc } = await supabase.from('processos_juridicos').select('id').eq('id', processoId).eq('empresa_id', empresaId).single()
  if (!proc) return { error: 'Processo não encontrado ou sem permissão.' }

  const { error } = await supabase
    .from('processos_juridicos')
    .update({ status: 'concluido' })
    .eq('id', processoId)

  if (error) return { error: error.message }

  const { error: errTimeline } = await supabase.from('movimentacoes_internas_processo').insert({
    processo_id: processoId,
    autor_id:    user.id,
    assunto:     `Processo concluído — ${motivo.trim()}`,
    descricao:   descricao?.trim() || null,
  })
  if (errTimeline) console.error('falha ao registrar timeline:', errTimeline)

  revalidatePath(`/processos/${processoId}`)
  revalidatePath('/processos')
  return {}
}

export async function reativarProcesso(
  processoId: string,
  motivo: string,
  descricao?: string,
): Promise<{ error?: string }> {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!user) return { error: 'Não autenticado.' }

  if (!empresaId) return { error: 'Empresa não encontrada.' }
  const { data: proc } = await supabase.from('processos_juridicos').select('id').eq('id', processoId).eq('empresa_id', empresaId).single()
  if (!proc) return { error: 'Processo não encontrado ou sem permissão.' }

  const { error } = await supabase
    .from('processos_juridicos')
    .update({ status: 'em_transito' })
    .eq('id', processoId)

  if (error) return { error: error.message }

  const { error: errTimeline } = await supabase.from('movimentacoes_internas_processo').insert({
    processo_id: processoId,
    autor_id:    user.id,
    assunto:     `Processo reativado — ${motivo.trim()}`,
    descricao:   descricao?.trim() || null,
  })
  if (errTimeline) console.error('falha ao registrar timeline:', errTimeline)

  revalidatePath(`/processos/${processoId}`)
  revalidatePath('/processos')
  return {}
}

export async function marcarComoLido(processoId: string) {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!user) return

  // Empresa efetiva para evitar escrita cross-tenant
  if (!empresaId) return

  await supabase
    .from('movimentacoes_processo')
    .update({ lido: true })
    .eq('processo_id', processoId)
    .eq('empresa_id', empresaId)
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
