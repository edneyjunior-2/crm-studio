/**
 * Parser do "Cartão Ponto" da Secullum Ponto Web (PDF).
 *
 * Estratégia: usa as coordenadas (x,y) de cada item de texto do PDF
 * (pdfjs-dist) em vez de tentar interpretar o texto "achatado" — a Secullum
 * renderiza a tabela diária numa grade de colunas de largura fixa, então a
 * posição x de um valor diz exatamente a qual coluna ele pertence, sem
 * ambiguidade (ao contrário de tentar inferir pela ordem/quantidade de
 * tokens numa linha, que é ambíguo quando a Secullum omite colunas zeradas).
 *
 * Cada página do relatório = um colaborador.
 */

export type TipoDiaSecullum = 'normal' | 'falta' | 'atestado' | 'folga_banco_horas'

export interface DiaSecullum {
  data: string // 'YYYY-MM-DD'
  tipo: TipoDiaSecullum
  entrada_1: string | null
  saida_1: string | null
  entrada_2: string | null
  saida_2: string | null
  batidaManual: boolean
}

export interface ColaboradorSecullum {
  pagina: number
  nome: string | null
  cpf: string | null
  admissao: string | null // 'YYYY-MM-DD'
  funcao: string | null
  dias: DiaSecullum[]
  avisos: string[]
}

export interface FolhaSecullumParseada {
  periodoInicio: string | null // 'YYYY-MM-DD'
  periodoFim: string | null
  colaboradores: ColaboradorSecullum[]
}

interface ItemTexto {
  x: number
  y: number
  texto: string
}

const LARGURA_COLUNA = 40
// Ordem das colunas a partir da âncora "ENTRADA 1" (múltiplos de LARGURA_COLUNA)
const COLUNAS_TABELA = [
  'entrada_1', 'saida_1', 'entrada_2', 'saida_2',
  'normais', 'faltas', 'dsr', 'carga', 'ajuste', 'bcred', 'bdeb', 'bsaldo',
] as const

const TOLERANCIA_X = 15
const REGEX_HORA = /^(\d{2}:\d{2})(\*)?$/
const REGEX_CPF = /(\d{3}\.\d{3}\.\d{3}-\d{2})/
const REGEX_DATA_BR = /(\d{2})\/(\d{2})\/(\d{4})/
const REGEX_LINHA_DIA = /^(\d{2})\/(\d{2})\/(\d{4})/
/** A tabela "HORÁRIO DE TRABALHO" fica ao lado do bloco de dados do colaborador,
 * com linhas que se intercalam na mesma faixa de Y — restringe a extração do
 * cabeçalho (nome/cpf/admissão/função) à coluna esquerda da página. */
const LIMITE_X_COLUNA_ESQUERDA = 300

function dataBrParaIso(dia: string, mes: string, ano: string): string {
  return `${ano}-${mes}-${dia}`
}

/** Agrupa itens de texto em linhas pela coordenada Y (mesma linha visual = mesmo Y). */
function agruparPorLinha(itens: ItemTexto[]): Map<number, ItemTexto[]> {
  const linhas = new Map<number, ItemTexto[]>()
  for (const item of itens) {
    const chave = Math.round(item.y)
    if (!linhas.has(chave)) linhas.set(chave, [])
    linhas.get(chave)!.push(item)
  }
  for (const itensLinha of linhas.values()) {
    itensLinha.sort((a, b) => a.x - b.x)
  }
  return linhas
}

/** Encontra a âncora x da coluna ENTRADA 1 a partir da linha de cabeçalho da tabela diária. */
function encontrarAncoraEntrada1(linhasOrdenadas: [number, ItemTexto[]][]): number | null {
  for (const [, itens] of linhasOrdenadas) {
    const temData = itens.some((i) => i.texto.trim() === 'DATA')
    if (!temData) continue
    const itemEntrada = itens.find((i) => i.texto.trim().startsWith('ENTRADA'))
    if (itemEntrada) return itemEntrada.x
  }
  return null
}

function valorNaColuna(itensLinha: ItemTexto[], xAlvo: number): string | null {
  const item = itensLinha.find((i) => Math.abs(i.x - xAlvo) <= TOLERANCIA_X)
  return item ? item.texto.trim() : null
}

/** Extrai o CPF, admissão, nome e função do bloco de cabeçalho (antes da tabela diária). */
function extrairCabecalho(
  linhasOrdenadas: [number, ItemTexto[]][],
  yTabela: number | null,
): { nome: string | null; cpf: string | null; admissao: string | null; funcao: string | null } {
  const linhasCabecalho: [number, ItemTexto[]][] = linhasOrdenadas
    .filter(([y]) => yTabela === null || y > yTabela)
    .map(([y, itens]): [number, ItemTexto[]] => [y, itens.filter((i) => i.x < LIMITE_X_COLUNA_ESQUERDA)])
    .filter(([, itens]) => itens.length > 0)
  const linhasSemPeriodo = linhasCabecalho.filter(
    ([, itens]) => !itens.some((i) => i.texto.includes('Período')),
  )

  let cpf: string | null = null
  let admissao: string | null = null
  let nome: string | null = null
  let funcao: string | null = null

  for (let idx = 0; idx < linhasSemPeriodo.length; idx++) {
    const [, itens] = linhasSemPeriodo[idx]
    const textoLinha = itens.map((i) => i.texto).join(' ')

    if (!cpf) {
      const m = textoLinha.match(REGEX_CPF)
      if (m) cpf = m[1]
    }
    if (!admissao) {
      const m = textoLinha.match(REGEX_DATA_BR)
      if (m) admissao = dataBrParaIso(m[1], m[2], m[3])
    }
    if (!nome && itens.some((i) => i.texto.trim() === 'NOME:')) {
      // Entre o rótulo "NOME:" e o nome de verdade existe uma linha
      // intermediária só com o valor de "Nº FOLHA:" (um número) — pula
      // qualquer linha puramente numérica até achar a que tem o nome.
      for (let j = idx + 1; j < Math.min(idx + 4, linhasSemPeriodo.length); j++) {
        const candidato = linhasSemPeriodo[j][1].map((i) => i.texto).join(' ').replace(/\s+/g, ' ').trim()
        if (candidato && !/^\d+$/.test(candidato)) {
          nome = candidato
          break
        }
      }
    }
    if (!funcao && itens.some((i) => i.texto.trim() === 'FUNÇÃO:')) {
      // "DEPARTAMENTO:" fica na mesma linha de rótulo, à direita — usa a
      // posição real dele pra separar função/departamento na linha de valor
      // logo abaixo, em vez de um limite fixo (que pode cortar cargos longos).
      const itemDepartamento = itens.find((i) => i.texto.trim() === 'DEPARTAMENTO:')
      const limite = itemDepartamento ? itemDepartamento.x : LIMITE_X_COLUNA_ESQUERDA
      const proxima = linhasSemPeriodo[idx + 1]
      if (proxima) {
        const esquerda = proxima[1].filter((i) => i.x < limite).map((i) => i.texto).join(' ')
        funcao = esquerda.replace(/\s+/g, ' ').trim() || null
      }
    }
  }

  return { nome, cpf, admissao, funcao }
}

function parsePagina(itens: ItemTexto[], pagina: number): ColaboradorSecullum {
  const avisos: string[] = []
  const linhas = agruparPorLinha(itens)
  // Ordena do topo pro fundo da página (Y maior = mais acima em coordenadas PDF)
  const linhasOrdenadas = [...linhas.entries()].sort((a, b) => b[0] - a[0])

  const ancoraEntrada1 = encontrarAncoraEntrada1(linhasOrdenadas)

  let yTabela: number | null = null
  for (const [y, itensLinha] of linhasOrdenadas) {
    if (itensLinha.some((i) => i.texto.trim() === 'DATA')) {
      yTabela = y
      break
    }
  }

  const { nome, cpf, admissao, funcao } = extrairCabecalho(linhasOrdenadas, yTabela)
  if (!cpf) avisos.push('CPF não identificado nesta página.')
  if (!nome) avisos.push('Nome não identificado nesta página.')

  const anchors: Record<string, number> = {}
  if (ancoraEntrada1 !== null) {
    COLUNAS_TABELA.forEach((col, i) => {
      anchors[col] = ancoraEntrada1 + i * LARGURA_COLUNA
    })
  } else {
    avisos.push('Cabeçalho da tabela diária não encontrado — colunas não identificadas.')
  }

  const dias: DiaSecullum[] = []

  if (ancoraEntrada1 !== null) {
    for (const [, itensLinha] of linhasOrdenadas) {
      const primeiro = itensLinha[0]
      if (!primeiro) continue
      const matchData = primeiro.texto.match(REGEX_LINHA_DIA)
      if (!matchData) continue // ignora TOTAIS e qualquer outra linha que não seja um dia

      const dataIso = dataBrParaIso(matchData[1], matchData[2], matchData[3])

      const bruto = {
        entrada_1: valorNaColuna(itensLinha, anchors.entrada_1),
        saida_1: valorNaColuna(itensLinha, anchors.saida_1),
        entrada_2: valorNaColuna(itensLinha, anchors.entrada_2),
        saida_2: valorNaColuna(itensLinha, anchors.saida_2),
      }

      const rotulo = [bruto.entrada_1, bruto.saida_1, bruto.entrada_2, bruto.saida_2].find(
        (v) => v && !REGEX_HORA.test(v),
      )

      if (rotulo === 'FOLGA' || rotulo === 'Feriado') {
        continue // não gera linha — derivado do calendário na tela de Cartão de Ponto
      }

      if (rotulo === 'FALTA' || rotulo === 'Atest' || rotulo === 'FolgaBH') {
        dias.push({
          data: dataIso,
          tipo: rotulo === 'FALTA' ? 'falta' : rotulo === 'Atest' ? 'atestado' : 'folga_banco_horas',
          entrada_1: null,
          saida_1: null,
          entrada_2: null,
          saida_2: null,
          batidaManual: false,
        })
        continue
      }

      const algumHorario = [bruto.entrada_1, bruto.saida_1, bruto.entrada_2, bruto.saida_2].some(
        (v) => v && REGEX_HORA.test(v),
      )
      if (!algumHorario) {
        avisos.push(`Dia ${dataIso}: linha não reconhecida, ignorada.`)
        continue
      }

      const extrai = (v: string | null): { valor: string | null; manual: boolean } => {
        if (!v) return { valor: null, manual: false }
        const m = v.match(REGEX_HORA)
        if (!m) return { valor: null, manual: false }
        return { valor: m[1], manual: !!m[2] }
      }
      const e1 = extrai(bruto.entrada_1)
      const s1 = extrai(bruto.saida_1)
      const e2 = extrai(bruto.entrada_2)
      const s2 = extrai(bruto.saida_2)

      dias.push({
        data: dataIso,
        tipo: 'normal',
        entrada_1: e1.valor,
        saida_1: s1.valor,
        entrada_2: e2.valor,
        saida_2: s2.valor,
        batidaManual: e1.manual || s1.manual || e2.manual || s2.manual,
      })
    }
  }

  return { pagina, nome, cpf, admissao, funcao, dias, avisos }
}

export async function parseFolhaSecullum(bytes: Uint8Array): Promise<FolhaSecullumParseada> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await getDocument({ data: bytes }).promise

  let periodoInicio: string | null = null
  let periodoFim: string | null = null
  const colaboradores: ColaboradorSecullum[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const itens: ItemTexto[] = content.items
      .map((raw) => {
        const item = raw as { str?: string; transform?: number[] }
        if (typeof item.str !== 'string' || !item.transform) return null
        return { x: item.transform[4] as number, y: item.transform[5] as number, texto: item.str }
      })
      .filter((i): i is ItemTexto => i !== null && i.texto.trim() !== '')

    if (p === 1) {
      const textoCompleto = itens.map((i) => i.texto).join(' ')
      const mPeriodo = textoCompleto.match(/Período:\s*(\d{2})\/(\d{2})\/(\d{4})\s*até\s*(\d{2})\/(\d{2})\/(\d{4})/)
      if (mPeriodo) {
        periodoInicio = dataBrParaIso(mPeriodo[1], mPeriodo[2], mPeriodo[3])
        periodoFim = dataBrParaIso(mPeriodo[4], mPeriodo[5], mPeriodo[6])
      }
    }

    colaboradores.push(parsePagina(itens, p))
  }

  // Rede de segurança: se o período é conhecido mas um colaborador tem muito
  // menos dias do que o esperado, algo pode ter sido pulado silenciosamente
  // (ex.: data quebrada em itens de texto separados por um export diferente).
  if (periodoInicio && periodoFim) {
    const totalDiasPeriodo =
      Math.round((new Date(periodoFim).getTime() - new Date(periodoInicio).getTime()) / 86400000) + 1
    const minimoEsperado = Math.floor(totalDiasPeriodo * 0.5)
    for (const col of colaboradores) {
      if (col.dias.length < minimoEsperado) {
        col.avisos.push(
          `Só ${col.dias.length} dias identificados num período de ${totalDiasPeriodo} — confira se o PDF tem esse formato esperado.`,
        )
      }
    }
  }

  return { periodoInicio, periodoFim, colaboradores }
}
