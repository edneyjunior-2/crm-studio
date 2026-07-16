'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import { listarEstagios } from '@/lib/pipeline-estagios'
import type { EstagioNegocio } from '@/types'

export interface GerarNegocioState { error?: string; negocioId?: string }

/**
 * Cria um negócio no pipeline a partir de uma cotação de frete e grava
 * `negocio_id` de volta em `frete_cotacoes`. Idempotente: se a cotação já tem
 * um negócio vinculado, devolve o mesmo id em vez de duplicar.
 *
 * NÃO reimplementa o fechamento financeiro (gerarFinanceiroDoFechamento em
 * pipeline/fechamento-financeiro-actions.ts) — ele já dispara sozinho quando
 * este negócio for movido para "ganho" no kanban existente.
 */
export async function gerarNegocioDaCotacao(cotacaoId: string): Promise<GerarNegocioState> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { data: cotacao, error: cotacaoErro } = await supabase
    .from('frete_cotacoes')
    .select('id, origem, destino, cliente_id, valor_negociado, valor_piso_antt, negocio_id, observacoes')
    .eq('id', cotacaoId)
    .eq('empresa_id', empresaId)
    .single()

  if (cotacaoErro || !cotacao) return { error: 'Cotação não encontrada.' }

  if (cotacao.negocio_id) return { negocioId: cotacao.negocio_id as string }

  const valorEstimado = (cotacao.valor_negociado as number | null) ?? (cotacao.valor_piso_antt as number | null)

  // Primeiro estágio ABERTO do funil da empresa — nunca por slug fixo (mesma
  // regra de resolverTipoEstagio em pipeline/actions.ts). listarEstagios() já
  // vem ordenado por `ordem` e cai no fallback padrão se o tenant não tiver
  // etapas próprias configuradas.
  const estagios = await listarEstagios()
  const estagioInicial = estagios.find((e) => e.tipo === 'aberto') ?? estagios[0]
  if (!estagioInicial) return { error: 'Nenhuma etapa de funil configurada para esta empresa.' }

  const origem  = cotacao.origem as string
  const destino = cotacao.destino as string

  const { data: negocio, error: negocioErro } = await supabase
    .from('negocios')
    .insert({
      empresa_id:               empresaId,
      cliente_id:               (cotacao.cliente_id as string | null) ?? null,
      solucao_id:               null,
      responsavel_id:           user.id,
      titulo:                   `Frete: ${origem} → ${destino}`,
      estagio:                  estagioInicial.slug as EstagioNegocio,
      valor_estimado:           valorEstimado,
      probabilidade:            null,
      data_previsao_fechamento: null,
      observacoes:              `Gerado automaticamente a partir da cotação de frete ${origem} → ${destino}.${cotacao.observacoes ? ` ${cotacao.observacoes as string}` : ''}`,
    })
    .select('id')
    .single()

  if (negocioErro || !negocio) return { error: negocioErro?.message ?? 'Erro ao criar negócio.' }

  const { error: updateErro } = await supabase
    .from('frete_cotacoes')
    .update({ negocio_id: negocio.id })
    .eq('id', cotacaoId)
    .eq('empresa_id', empresaId)

  if (updateErro) return { error: updateErro.message }

  revalidatePath(`/frete/cotacoes/${cotacaoId}`)
  revalidatePath('/pipeline')
  return { negocioId: negocio.id }
}
