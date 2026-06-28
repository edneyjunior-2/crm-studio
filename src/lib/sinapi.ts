/**
 * sinapi.ts — utilidades do catálogo de preços de referência (SINAPI/ORSE).
 *
 * O SINAPI publica planilhas mensais por UF (Relatórios Mensais da Caixa), com
 * Insumos e Composições, cada um com custo "com desoneração" e "sem desoneração".
 * Não há API pública → import da planilha .xlsx.
 *
 * O parser abaixo é TOLERANTE a variações de cabeçalho: mapeia colunas por
 * palavras-chave normalizadas. Precisa ser calibrado com uma planilha real
 * SINAPI-BA (algumas versões têm linhas de cabeçalho extras / células mescladas).
 */

export type TipoPreco = 'insumo' | 'composicao'

export interface PrecoReferenciaRow {
  fonte: string
  uf: string
  data_ref: string // YYYY-MM-DD (1º dia do mês)
  tipo: TipoPreco
  codigo: string
  descricao: string
  unidade: string | null
  grupo: string | null
  custo_com_desoneracao: number | null
  custo_sem_desoneracao: number | null
}

/** Normaliza texto de cabeçalho: minúsculo, sem acento, sem espaços extras. */
function normHeader(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Converte "1.234,56" / "1234.56" / number → number | null. */
export function parseValorBR(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/[R$\s]/g, '')
  if (!s) return null
  // pt-BR: ponto = milhar, vírgula = decimal
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Acha o índice da coluna cujo cabeçalho casa com qualquer um dos termos. */
function findCol(headers: string[], termos: string[]): number {
  return headers.findIndex((h) => termos.some((t) => h.includes(t)))
}

/**
 * Mapeia uma matriz de linhas (array de arrays) vinda de uma planilha SINAPI
 * para PrecoReferenciaRow[]. `tipo` é informado por aba/seleção (insumo|composicao).
 *
 * Detecta a linha de cabeçalho (primeira com "codigo" e "descricao") e mapeia:
 *   código, descrição, unidade, custo com/sem desoneração.
 */
export function parseSinapiMatrix(
  rows: unknown[][],
  ctx: { fonte: string; uf: string; data_ref: string; tipo: TipoPreco },
): { itens: PrecoReferenciaRow[]; headerRow: number; aviso?: string } {
  // Acha a linha de cabeçalho
  let headerRow = -1
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const hs = (rows[i] ?? []).map(normHeader)
    if (hs.some((h) => h.includes('codigo')) && hs.some((h) => h.includes('descric'))) {
      headerRow = i
      break
    }
  }
  if (headerRow === -1) {
    return { itens: [], headerRow: -1, aviso: 'Cabeçalho não encontrado (procure colunas Código e Descrição).' }
  }

  const headers = (rows[headerRow] ?? []).map(normHeader)
  const ci = {
    codigo: findCol(headers, ['codigo']),
    descricao: findCol(headers, ['descric']),
    unidade: findCol(headers, ['unidade', 'und', 'un']),
    grupo: findCol(headers, ['grupo', 'classe']),
    com: findCol(headers, ['com desoner', 'custo com', 'preco com']),
    sem: findCol(headers, ['sem desoner', 'custo sem', 'preco sem']),
    // fallback: uma única coluna de custo/preço quando não há distinção
    custo: findCol(headers, ['custo', 'preco', 'valor']),
  }

  const itens: PrecoReferenciaRow[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    const codigo = String(r[ci.codigo] ?? '').trim()
    const descricao = String(r[ci.descricao] ?? '').trim()
    if (!codigo || !descricao) continue

    const com = ci.com >= 0 ? parseValorBR(r[ci.com]) : null
    const sem = ci.sem >= 0 ? parseValorBR(r[ci.sem]) : null
    const unico = ci.custo >= 0 ? parseValorBR(r[ci.custo]) : null

    itens.push({
      fonte: ctx.fonte,
      uf: ctx.uf,
      data_ref: ctx.data_ref,
      tipo: ctx.tipo,
      codigo,
      descricao,
      unidade: ci.unidade >= 0 ? String(r[ci.unidade] ?? '').trim() || null : null,
      grupo: ci.grupo >= 0 ? String(r[ci.grupo] ?? '').trim() || null : null,
      custo_com_desoneracao: com ?? unico,
      custo_sem_desoneracao: sem ?? unico,
    })
  }

  return { itens, headerRow }
}
