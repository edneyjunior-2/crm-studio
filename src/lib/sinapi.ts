/**
 * sinapi.ts — parser do arquivo oficial "SINAPI_Referência_AAAA_MM.xlsx" (Caixa).
 *
 * Estrutura real (validada com 2026-05):
 *  - Arquivo NACIONAL: cada estado é uma coluna. Abas relevantes:
 *      ISD = Insumos Sem Desoneração   | ICD = Insumos Com Desoneração
 *      CSD = Composições Sem Deson.    | CCD = Composições Com Desoneração
 *  - Linha com os códigos de UF (AC, AL, ..., BA, ...) define a coluna do estado.
 *  - Insumos: 1 coluna por UF (preço). Composições: 2 colunas por UF (Custo (R$) + %AS),
 *    a coluna do estado aponta direto para o "Custo (R$)".
 *  - INSUMOS: código vem como valor normal na coluna "Código do Insumo".
 *  - COMPOSIÇÕES: o código está embutido numa FÓRMULA HYPERLINK(...MATCH(<codigo>,...))
 *    e o valor exibido da célula é 0 — por isso extraímos o número da fórmula.
 */

import * as XLSX from '@e965/xlsx'

export type TipoPreco = 'insumo' | 'composicao'

export interface PrecoReferenciaRow {
  fonte: string
  uf: string
  data_ref: string // YYYY-MM-DD
  tipo: TipoPreco
  codigo: string
  descricao: string
  unidade: string | null
  grupo: string | null
  custo_com_desoneracao: number | null
  custo_sem_desoneracao: number | null
}

const UFS = new Set([
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
])

export function parseValorBR(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/[R$\s]/g, '')
  if (!s || s === '-') return null
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function txt(ws: XLSX.WorkSheet, r: number, c: number): string {
  const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
  if (!cell) return ''
  return String(cell.w ?? cell.v ?? '').trim()
}

function num(ws: XLSX.WorkSheet, r: number, c: number): number | null {
  const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
  if (!cell) return null
  if (typeof cell.v === 'number') return cell.v
  return parseValorBR(cell.w ?? cell.v)
}

/** Código: nas composições vem na fórmula HYPERLINK(...MATCH(<codigo>,...)); nos insumos é valor normal. */
function codigo(ws: XLSX.WorkSheet, r: number, c: number): string {
  const cell = ws[XLSX.utils.encode_cell({ r, c })] as (XLSX.CellObject & { f?: string }) | undefined
  if (!cell) return ''
  if (cell.f) {
    const m = cell.f.match(/MATCH\(\s*(\d+)/) || cell.f.match(/,\s*(\d+)\s*\)\s*$/)
    if (m) return m[1]
  }
  const v = cell.w ?? cell.v
  if (v == null) return ''
  const s = String(v).trim()
  return s === '0' ? '' : s
}

interface SheetLayout {
  headerRow: number
  colCodigo: number
  colDescricao: number
  colUnidade: number
  colGrupo: number
  colUf: number
}

function detectLayout(ws: XLSX.WorkSheet, uf: string): SheetLayout | null {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const maxScan = Math.min(range.e.r, 25)
  const maxCol = Math.min(range.e.c, 80)

  // 1) linha de cabeçalho de campos: tem "descri" e "unidade"
  let headerRow = -1
  let colCodigo = -1, colDescricao = -1, colUnidade = -1, colGrupo = -1
  for (let r = 0; r <= maxScan && headerRow === -1; r++) {
    let cCod = -1, cDesc = -1, cUnid = -1, cGrp = -1
    for (let c = 0; c <= maxCol; c++) {
      const t = txt(ws, r, c).toLowerCase().replace(/\s+/g, ' ')
      if (cCod < 0 && /c[oó]digo/.test(t)) cCod = c
      if (cDesc < 0 && /descri/.test(t)) cDesc = c
      if (cUnid < 0 && /unidade/.test(t)) cUnid = c
      if (cGrp < 0 && /(grupo|classific)/.test(t)) cGrp = c
    }
    if (cDesc >= 0 && cUnid >= 0 && cCod >= 0) {
      headerRow = r; colCodigo = cCod; colDescricao = cDesc; colUnidade = cUnid; colGrupo = cGrp >= 0 ? cGrp : 0
    }
  }
  if (headerRow === -1) return null

  // 2) linha dos códigos de UF (a com mais siglas) — entre headerRow-4 e headerRow
  let colUf = -1, best = 0
  for (let r = Math.max(0, headerRow - 4); r <= headerRow; r++) {
    let count = 0, baCol = -1
    for (let c = 0; c <= maxCol; c++) {
      const t = txt(ws, r, c).toUpperCase()
      if (UFS.has(t)) { count++; if (t === uf) baCol = c }
    }
    if (count > best && baCol >= 0) { best = count; colUf = baCol }
  }
  if (colUf === -1) return null

  return { headerRow, colCodigo, colDescricao, colUnidade, colGrupo, colUf }
}

/** Lê uma aba (ISD/ICD/CSD/CCD) → Map<codigo, {descricao,unidade,grupo,custo}> para a UF. */
function parseSheet(
  ws: XLSX.WorkSheet,
  uf: string,
): Map<string, { descricao: string; unidade: string | null; grupo: string | null; custo: number | null }> {
  const out = new Map<string, { descricao: string; unidade: string | null; grupo: string | null; custo: number | null }>()
  const layout = detectLayout(ws, uf)
  if (!layout) return out
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let r = layout.headerRow + 1; r <= range.e.r; r++) {
    const cod = codigo(ws, r, layout.colCodigo)
    const desc = txt(ws, r, layout.colDescricao)
    if (!cod || !desc) continue
    out.set(cod, {
      descricao: desc,
      unidade: txt(ws, r, layout.colUnidade) || null,
      grupo: txt(ws, r, layout.colGrupo) || null,
      custo: num(ws, r, layout.colUf),
    })
  }
  return out
}

/**
 * Processa o arquivo SINAPI_Referência completo → linhas para precos_referencia,
 * mesclando custo com/sem desoneração por código, para insumos e composições.
 */
export function parseSinapiReferencia(
  wb: XLSX.WorkBook,
  ctx: { fonte: string; uf: string; data_ref: string },
): { itens: PrecoReferenciaRow[]; resumo: Record<string, number>; aviso?: string } {
  const grupos: { tipo: TipoPreco; sem: string; com: string }[] = [
    { tipo: 'insumo', sem: 'ISD', com: 'ICD' },
    { tipo: 'composicao', sem: 'CSD', com: 'CCD' },
  ]
  const itens: PrecoReferenciaRow[] = []
  const resumo: Record<string, number> = {}

  for (const g of grupos) {
    const wsSem = wb.Sheets[g.sem]
    const wsCom = wb.Sheets[g.com]
    if (!wsSem && !wsCom) continue
    const mapSem = wsSem ? parseSheet(wsSem, ctx.uf) : new Map()
    const mapCom = wsCom ? parseSheet(wsCom, ctx.uf) : new Map()
    const codigos = new Set<string>([...mapSem.keys(), ...mapCom.keys()])
    let n = 0
    for (const cod of codigos) {
      const base = mapSem.get(cod) ?? mapCom.get(cod)!
      itens.push({
        fonte: ctx.fonte,
        uf: ctx.uf,
        data_ref: ctx.data_ref,
        tipo: g.tipo,
        codigo: cod,
        descricao: base.descricao,
        unidade: base.unidade,
        grupo: base.grupo,
        custo_sem_desoneracao: mapSem.get(cod)?.custo ?? null,
        custo_com_desoneracao: mapCom.get(cod)?.custo ?? null,
      })
      n++
    }
    resumo[g.tipo] = n
  }

  if (itens.length === 0) {
    return { itens, resumo, aviso: 'Nenhum item reconhecido. Confirme que é o arquivo SINAPI_Referência (abas ISD/ICD/CSD/CCD) e a UF.' }
  }
  return { itens, resumo }
}
