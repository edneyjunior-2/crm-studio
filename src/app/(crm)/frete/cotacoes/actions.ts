'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import { cotacaoFreteSchema } from '@/lib/schemas'
import { calcularPisoMinimoAntt, buscarCoeficienteVigente } from '@/lib/frete/antt-calculadora'

export interface CotacaoActionState { error?: string; id?: string }

const STATUS_COTACAO = ['rascunho', 'enviada', 'aprovada', 'em_viagem', 'concluida', 'cancelada'] as const

export async function criarCotacao(
  _prev: CotacaoActionState | null,
  formData: FormData,
): Promise<CotacaoActionState | null> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const parsed = cotacaoFreteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  if (!parsed.data.origem || !parsed.data.destino) return { error: 'Origem e destino são obrigatórios.' }

  // cotacaoFreteSchema (Stream 1) não cobre valor_negociado/observacoes — lidos
  // direto do FormData e validados manualmente aqui.
  const valorNegociadoRaw = (formData.get('valor_negociado') as string)?.trim()
  const valorNegociado    = valorNegociadoRaw ? Number(valorNegociadoRaw) : null
  if (valorNegociado != null && Number.isNaN(valorNegociado)) return { error: 'Valor negociado inválido.' }
  const observacoes = (formData.get('observacoes') as string)?.trim() || null

  // Segurança: piso ANTT é SEMPRE recalculado no servidor — nunca aceito do client
  // (ponytail: sem preview reativo no form; o cálculo roda uma vez, aqui, no submit).
  const coeficiente = await buscarCoeficienteVigente(supabase, parsed.data.tabela_antt, parsed.data.tipo_carga)
  if (!coeficiente) {
    return { error: 'Coeficiente ANTT não encontrado para esta combinação de tabela e tipo de carga.' }
  }
  const valorPisoAntt = calcularPisoMinimoAntt(parsed.data.distancia_km, coeficiente)

  const { data, error } = await supabase
    .from('frete_cotacoes')
    .insert({
      empresa_id:      empresaId,
      cliente_id:      parsed.data.cliente_id ?? null,
      veiculo_id:      parsed.data.veiculo_id ?? null,
      motorista_id:    parsed.data.motorista_id ?? null,
      origem:          parsed.data.origem,
      destino:         parsed.data.destino,
      distancia_km:    parsed.data.distancia_km,
      tabela_antt:     parsed.data.tabela_antt,
      tipo_carga:      parsed.data.tipo_carga,
      valor_piso_antt: valorPisoAntt,
      valor_negociado: valorNegociado,
      status:          'rascunho',
      observacoes,
      created_by:      user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/frete/cotacoes')
  revalidatePath('/frete')
  return { id: data.id }
}

export async function atualizarStatusCotacao(id: string, status: string): Promise<{ error?: string }> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  if (!(STATUS_COTACAO as readonly string[]).includes(status)) {
    return { error: 'Status inválido.' }
  }

  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { error } = await supabase
    .from('frete_cotacoes')
    .update({ status })
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/frete/cotacoes/${id}`)
  revalidatePath('/frete/cotacoes')
  revalidatePath('/frete')
  return {}
}
