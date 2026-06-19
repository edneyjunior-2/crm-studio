/**
 * Cálculo do honorário do advogado por processo.
 *
 * - tipo 'fixo'       → honorario = valor (em R$)
 * - tipo 'percentual' → honorario = valor_causa * (valor / 100)
 *
 * valor_causa é o valor GLOBAL da causa (mantido para relatórios); o honorário
 * é a parcela que de fato é do advogado e baseia a "previsão de ganho".
 */
export function calcularHonorarios(
  tipo: string | null | undefined,
  valor: number | null | undefined,
  valorCausa: number | null | undefined,
): number | null {
  if (!tipo || valor == null || Number.isNaN(valor)) return null
  if (tipo === 'fixo') return valor
  if (tipo === 'percentual') {
    if (valorCausa == null || Number.isNaN(valorCausa)) return null
    return (valorCausa * valor) / 100
  }
  return null
}

export function formatarBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
