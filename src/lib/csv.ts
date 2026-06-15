/**
 * Helper de serialização CSV para exportação LGPD.
 *
 * Padrão:
 *  - BOM UTF-8 (U+FEFF) para abrir corretamente no Excel-BR
 *  - Separador: ponto-e-vírgula (;)
 *  - Campos com ;, aspas ou quebra de linha: envolvidos em aspas duplas,
 *    aspas internas dobradas ("")
 *  - Datas: yyyy-mm-dd (sem toISOString — via getFullYear/getMonth/getDate)
 *  - Valores numéricos: crus (sem R$)
 */

const BOM = '﻿'
const SEP = ';'

/** Escapa um campo CSV: aspas duplas ao redor se contiver ;, " ou \n */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''

  let str: string
  if (typeof value === 'number') {
    str = String(value)
  } else if (value instanceof Date) {
    str = formatDate(value)
  } else {
    str = String(value)
  }

  // Normaliza: se contém separador, aspas ou quebra de linha → envolver
  if (str.includes(SEP) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

/** Formata data local como yyyy-mm-dd sem toISOString */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Serializa um array de objetos para CSV.
 * @param headers - Mapa de {chave: cabeçalho PT-BR} na ordem desejada
 * @param rows - Array de objetos (linhas)
 */
export function toCsv<T extends Record<string, unknown>>(
  headers: Record<string, string>,
  rows: T[]
): string {
  const keys = Object.keys(headers)
  const headerLine = keys.map((k) => escapeCsvField(headers[k])).join(SEP)
  const dataLines = rows.map((row) =>
    keys.map((k) => escapeCsvField(row[k])).join(SEP)
  )
  return BOM + [headerLine, ...dataLines].join('\n')
}

/** Gera um nome de arquivo com data atual: prefix-yyyy-mm-dd.ext */
export function exportFilename(prefix: string, ext: 'csv' | 'json'): string {
  const today = new Date()
  return `${prefix}-${formatDate(today)}.${ext}`
}
