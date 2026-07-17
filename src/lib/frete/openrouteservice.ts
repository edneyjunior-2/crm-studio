/**
 * openrouteservice.ts — distância de rota real (rodovia, não linha reta)
 * entre duas cidades brasileiras, via OpenRouteService (dados OpenStreetMap).
 *
 * Decisão (research/28-distancia-rota-cidades-api.md): OpenRouteService em vez
 * de Google Routes API — gratuito, sem cartão, uso comercial permitido no
 * free tier (~2.000 req/dia), sem custo fixo mensal (mesma lógica de
 * research/26/27 pro OCR de CNH). Requer cadastro grátis em
 * account.heigit.org pra gerar a API key — env var OPENROUTESERVICE_API_KEY.
 *
 * Geocodificação cidade→coordenada usa o dataset local `municipios-br.json`
 * (IBGE + coordenadas do dataset público kelvins/municipios-brasileiros) —
 * não depende de nenhuma API de geocoding externa.
 */

import municipios from './municipios-br.json'

export interface Coordenada {
  lat: number
  lon: number
}

/**
 * Busca a coordenada de uma cidade a partir do texto "Nome - UF" (formato
 * exato gerado pelo <datalist> de origem/destino da cotação). Retorna null
 * se o texto não bater com nenhum município cadastrado — NUNCA adivinha uma
 * coordenada aproximada.
 */
export function buscarCoordenadaCidade(cidadeUf: string): Coordenada | null {
  const match = cidadeUf.trim().match(/^(.+?)\s*-\s*([A-Za-z]{2})$/)
  if (!match) return null
  const [, nome, uf] = match

  const cidade = (municipios as { nome: string; uf: string; lat: number; lon: number }[]).find(
    (m) => m.nome.toLowerCase() === nome.toLowerCase() && m.uf.toUpperCase() === uf.toUpperCase()
  )
  return cidade ? { lat: cidade.lat, lon: cidade.lon } : null
}

/**
 * Chama a Directions API do OpenRouteService (perfil driving-hgv — caminhão)
 * e devolve a distância de rota em km. Lança erro explícito se a API key não
 * estiver configurada ou se a chamada falhar — nunca retorna um valor
 * aproximado/chutado.
 */
export async function calcularDistanciaRota(origem: Coordenada, destino: Coordenada): Promise<number> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTESERVICE_API_KEY não configurada — cadastre uma chave grátis em account.heigit.org e adicione a env var.')
  }

  const url =
    `https://api.openrouteservice.org/v2/directions/driving-hgv` +
    `?api_key=${encodeURIComponent(apiKey)}` +
    `&start=${origem.lon},${origem.lat}` +
    `&end=${destino.lon},${destino.lat}`

  const res = await fetch(url)
  if (!res.ok) {
    const corpo = await res.text().catch(() => '')
    throw new Error(`OpenRouteService respondeu ${res.status}: ${corpo.slice(0, 200)}`)
  }

  const data = await res.json()
  const distanciaMetros = data?.routes?.[0]?.summary?.distance
  if (typeof distanciaMetros !== 'number') {
    throw new Error('Resposta do OpenRouteService sem distância de rota (provável falta de rota entre os pontos).')
  }

  return distanciaMetros / 1000
}

/** Check rodável (não faz parte do build): `npx tsx src/lib/frete/openrouteservice.ts`. */
export function demo(): void {
  const salvador = buscarCoordenadaCidade('Salvador - BA')
  const aracaju = buscarCoordenadaCidade('Aracaju - SE')

  console.assert(salvador != null, 'Salvador - BA deveria ser encontrado no dataset')
  console.assert(aracaju != null, 'Aracaju - SE deveria ser encontrado no dataset')
  console.assert(buscarCoordenadaCidade('Cidade Que Não Existe - XX') === null, 'cidade inexistente deve retornar null')

  console.log('buscarCoordenadaCidade("Salvador - BA") =', salvador)
  console.log('buscarCoordenadaCidade("Aracaju - SE") =', aracaju)
  console.log('(chamada real à API do OpenRouteService não roda no demo — precisa de OPENROUTESERVICE_API_KEY)')
}
