'use server'

import { assertModulo } from '@/lib/gating'
import { buscarCoordenadaCidade, calcularDistanciaRota } from '@/lib/frete/openrouteservice'

export interface CalcularDistanciaResultado {
  distanciaKm?: number
  error?: string
}

/**
 * Calcula a distância de rota (rodovia) entre origem e destino, chamado
 * quando o vendedor sai do campo "Destino" no form de nova cotação. Erro é
 * sempre não-bloqueante pro fluxo: se falhar (cidade não reconhecida, chave
 * não configurada, API fora do ar), o campo de distância continua editável
 * manualmente — isto aqui só poupa digitação, nunca é obrigatório.
 */
export async function calcularDistanciaAction(origem: string, destino: string): Promise<CalcularDistanciaResultado> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const coordOrigem = buscarCoordenadaCidade(origem)
  const coordDestino = buscarCoordenadaCidade(destino)

  if (!coordOrigem || !coordDestino) {
    return { error: 'Selecione origem e destino a partir da lista de cidades para calcular automaticamente.' }
  }

  try {
    const km = await calcularDistanciaRota(coordOrigem, coordDestino)
    return { distanciaKm: Math.round(km * 10) / 10 }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao calcular distância.' }
  }
}
