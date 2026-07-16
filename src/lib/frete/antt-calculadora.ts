/**
 * antt-calculadora.ts — Piso mínimo de frete (ANTT)
 *
 * Spec: .claude/specs/frete-01-backend-schema-antt.md
 *
 * Fórmula oficial: Piso Mínimo (R$) = (Distância_km × CCD) + CC
 * (Lei 13.703/2018, Resolução ANTT vigente — ver `frete_antt_coeficientes`).
 *
 * Zero lógica de UI aqui: função pura + uma query. Coeficientes (CCD/CC) NUNCA
 * são chutados no código — vêm sempre do banco (tabela `frete_antt_coeficientes`,
 * hoje com apenas 1 linha de exemplo semeada; ver a migration
 * `modulo_frete_schema.sql` para o aviso de compliance).
 *
 * demo() roda o único exemplo confirmado na spec:
 *   distancia=500km, ccd=5.986, cc=478.76
 *   → (500 × 5.986) + 478.76 = 2993 + 478.76 = 3471.76
 */

import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface CoeficienteAntt {
  tabelaAntt: 'A' | 'B' | 'C' | 'D'
  tipoCarga: string
  ccd: number
  cc: number
  vigenciaInicio: string
}

/** Piso mínimo = (distância_km × CCD) + CC. Fórmula oficial ANTT (Lei 13.703/2018, Res. ANTT vigente). */
export function calcularPisoMinimoAntt(
  distanciaKm: number,
  coeficiente: Pick<CoeficienteAntt, 'ccd' | 'cc'>
): number {
  return distanciaKm * coeficiente.ccd + coeficiente.cc
}

/**
 * Busca o coeficiente vigente na data de hoje para a tabela+tipo de carga
 * pedidos. Retorna null se não houver linha cadastrada (chamador deve tratar
 * como "coeficiente não cadastrado ainda" — nunca usar um valor chutado).
 */
export async function buscarCoeficienteVigente(
  supabase: SupabaseServerClient,
  tabelaAntt: 'A' | 'B' | 'C' | 'D',
  tipoCarga: string
): Promise<CoeficienteAntt | null> {
  const hoje = new Date()
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('frete_antt_coeficientes')
    .select('tabela_antt, tipo_carga, ccd, cc, vigencia_inicio')
    .eq('tabela_antt', tabelaAntt)
    .eq('tipo_carga', tipoCarga)
    .lte('vigencia_inicio', hojeIso)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${hojeIso}`)
    .order('vigencia_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    tabelaAntt: data.tabela_antt,
    tipoCarga: data.tipo_carga,
    ccd: Number(data.ccd),
    cc: Number(data.cc),
    vigenciaInicio: data.vigencia_inicio,
  }
}

/** Check rodável (não faz parte do build): `npx tsx src/lib/frete/antt-calculadora.ts`. */
export function demo(): void {
  const distancia = 500
  const coeficiente = { ccd: 5.986, cc: 478.76 }
  const esperado = 3471.76
  const resultado = calcularPisoMinimoAntt(distancia, coeficiente)

  console.assert(
    Math.abs(resultado - esperado) < 0.01,
    `calcularPisoMinimoAntt(${distancia}, ${JSON.stringify(coeficiente)}) = ${resultado}, esperado ~${esperado}`
  )
  console.log(`calcularPisoMinimoAntt(500, {ccd:5.986, cc:478.76}) = ${resultado.toFixed(2)} (esperado ~3471.76)`)
}
