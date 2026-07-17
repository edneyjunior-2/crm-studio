'use server'

import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import { buscarCoeficienteVigente, calcularPisoMinimoAntt } from '@/lib/frete/antt-calculadora'

export interface CalcularPisoPreviewResultado {
  piso?: number
  /** true quando a combinação tabela/tipo de carga/eixos ainda não tem
   *  coeficiente cadastrado — NÃO é um erro de uso, é um estado esperado
   *  (hoje só Tabela A + carga geral/granel sólido estão completas). */
  semCoeficiente?: boolean
  error?: string
}

/**
 * Preview NÃO-autoritativo do piso mínimo ANTT, pro form mostrar em tempo
 * real enquanto o vendedor preenche a cotação. O valor final, oficial, é
 * SEMPRE recalculado no servidor de novo em criarCotacao ao salvar — este
 * preview nunca é enviado/confiado como o valor gravado (mesmo espírito de
 * segurança do comentário em actions.ts: "piso ANTT é SEMPRE recalculado no
 * servidor — nunca aceito do client").
 */
export async function calcularPisoPreviewAction(
  distanciaKm: number,
  tabelaAntt: string,
  tipoCarga: string,
  eixos: number,
): Promise<CalcularPisoPreviewResultado> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  if (!Number.isFinite(distanciaKm) || distanciaKm <= 0) return {}
  if (!['A', 'B', 'C', 'D'].includes(tabelaAntt)) return {}
  if (![2, 3, 4, 5, 6, 7, 9].includes(eixos)) return {}
  if (!tipoCarga) return {}

  const { supabase } = await getAuthUser()

  try {
    const coeficiente = await buscarCoeficienteVigente(supabase, tabelaAntt as 'A' | 'B' | 'C' | 'D', tipoCarga, eixos)
    if (!coeficiente) return { semCoeficiente: true }
    return { piso: calcularPisoMinimoAntt(distanciaKm, coeficiente) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao calcular o piso ANTT.' }
  }
}
