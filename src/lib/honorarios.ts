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

// ---------------------------------------------------------------------------
// Máscara de valor monetário (pt-BR) para inputs
// ---------------------------------------------------------------------------

/** Formata o que o usuário digita com separador de milhar: "8000" → "8.000",
 *  "8000,5" → "8.000,5". Aceita uma vírgula com até 2 casas decimais. */
export function mascararMilhar(raw: string): string {
  const s = (raw || '').replace(/[^\d,]/g, '')
  const i = s.indexOf(',')
  if (i !== -1) {
    const intP = s.slice(0, i).replace(/\D/g, '')
    const decP = s.slice(i + 1).replace(/\D/g, '').slice(0, 2)
    const intF = intP ? parseInt(intP, 10).toLocaleString('pt-BR') : '0'
    return `${intF},${decP}`
  }
  const d = s.replace(/\D/g, '')
  return d ? parseInt(d, 10).toLocaleString('pt-BR') : ''
}

/** Converte o valor mascarado ("8.000,50") em número (8000.5). */
export function parseValorBR(s: string | null | undefined): number {
  if (!s) return NaN
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

/** Número → máscara de exibição ("8.000" ou "8.000,50"). */
export function valorParaMascara(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
