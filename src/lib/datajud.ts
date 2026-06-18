/**
 * datajud.ts — Utilitário para a API pública do DataJud (CNJ)
 *
 * Detecta automaticamente o tribunal a partir do número CNJ e busca
 * processo e movimentações via API REST do DataJud.
 *
 * Número CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO (20 dígitos sem pontuação)
 * J  = segmento judicial (posição 13)
 * TT = código do tribunal (posições 14-15)
 */

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br'
const DATAJUD_KEY  = process.env.DATAJUD_API_KEY ?? 'cnjdevKey'

// ---------------------------------------------------------------------------
// Mapeamento J.TT → slug do tribunal (URL DataJud)
// ---------------------------------------------------------------------------

// Segmento 8 = Justiça Estadual (TJ por estado, código TT = código do estado)
const TJ_SLUGS: Record<string, string> = {
  '01': 'tjac', '02': 'tjal', '03': 'tjap', '04': 'tjam',
  '05': 'tjba', '06': 'tjce', '07': 'tjdft','08': 'tjes',
  '09': 'tjgo', '10': 'tjma', '11': 'tjmt', '12': 'tjms',
  '13': 'tjmg', '14': 'tjpa', '15': 'tjpb', '16': 'tjpr',
  '17': 'tjpe', '18': 'tjpi', '19': 'tjrj', '20': 'tjrn',
  '21': 'tjrs', '22': 'tjro', '23': 'tjrr', '24': 'tjsc',
  '25': 'tjse', '26': 'tjsp', '27': 'tjto',
}

// Código do tribunal DataJud por segmento + código numérico
function resolverSlug(segmento: string, tt: string): string {
  switch (segmento) {
    case '1': return 'stf'
    case '2': return 'cnj'
    case '3': return 'stj'
    case '4': return `trf${parseInt(tt, 10)}`   // TRF1..TRF6
    case '5': return `trt${parseInt(tt, 10)}`   // TRT1..TRT24
    case '6': return `tre${parseInt(tt, 10)}`   // TRE por código
    case '7': return 'stm'
    case '8': return TJ_SLUGS[tt] ?? 'desconhecido'
    case '9': return `sup${parseInt(tt, 10)}`   // Tribunais superiores especiais
    default:  return 'desconhecido'
  }
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DataJudMovimento {
  codigo:       number
  nome:         string
  dataHora:     string
  complemento?: string
}

export interface DataJudParte {
  polo: string
  nome: string
}

export interface DataJudProcesso {
  numeroProcesso:    string
  tribunalSlug:      string
  dataAjuizamento?:  string
  assunto?:          string
  vara?:             string
  comarca?:          string
  valor?:            number
  partes:            DataJudParte[]
  movimentos:        DataJudMovimento[]
}

// ---------------------------------------------------------------------------
// Detecta o tribunal a partir do número CNJ
// ---------------------------------------------------------------------------

export function detectarTribunal(numero: string): string {
  const digits = numero.replace(/\D/g, '')
  if (digits.length < 16) return 'desconhecido'
  const segmento = digits[13]
  const tt       = digits.slice(14, 16)
  return resolverSlug(segmento, tt)
}

// Normaliza o número CNJ para o formato com pontuação
export function normalizarNumeroCNJ(numero: string): string {
  const d = numero.replace(/\D/g, '')
  if (d.length !== 20) return numero
  return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16)}`
}

// ---------------------------------------------------------------------------
// Busca processo no DataJud
// ---------------------------------------------------------------------------

export async function buscarProcessoDataJud(
  numeroCNJ: string,
  tribunalSlug?: string,
): Promise<DataJudProcesso | null> {
  const slug    = tribunalSlug ?? detectarTribunal(numeroCNJ)
  const numero  = normalizarNumeroCNJ(numeroCNJ)

  if (slug === 'desconhecido') return null

  const url  = `${DATAJUD_BASE}/api_publica_${slug}/_search`
  const body = JSON.stringify({
    query: { match: { numeroProcesso: numero } },
    size:  1,
  })

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `APIKey ${DATAJUD_KEY}`,
      'Content-Type':  'application/json',
    },
    body,
    next: { revalidate: 0 },
  })

  if (!res.ok) return null

  const json = await res.json()
  const hit  = json?.hits?.hits?.[0]?._source
  if (!hit) return null

  const orgao     = hit.orgaoJulgador?.nome ?? ''
  const assuntos  = hit.assuntos ?? []
  const assunto   = assuntos[0]?.nome ?? ''

  // Extrai vara e comarca do nome do órgão julgador
  // Ex.: "1ª Vara Cível de Salvador" → vara="1ª Vara Cível", comarca="Salvador"
  const varaMatch    = orgao.match(/^(.+?) de (.+)$/)
  const vara         = varaMatch ? varaMatch[1] : orgao
  const comarca      = varaMatch ? varaMatch[2] : ''

  const movimentos: DataJudMovimento[] = (hit.movimentos ?? []).map((m: Record<string, unknown>) => ({
    codigo:      m.codigo as number ?? 0,
    nome:        m.nome as string ?? '',
    dataHora:    m.dataHora as string ?? '',
    complemento: extrairComplemento(m),
  }))

  return {
    numeroProcesso:   numero,
    tribunalSlug:     slug,
    dataAjuizamento:  hit.dataAjuizamento ?? null,
    assunto,
    vara,
    comarca,
    valor:   hit.valor ?? null,
    partes:  (hit.partes ?? []) as DataJudParte[],
    movimentos,
  }
}

function extrairComplemento(movimento: Record<string, unknown>): string {
  const tabelados    = (movimento.complementosTabelados as { descricao?: string }[] | undefined) ?? []
  const naoTabelados = (movimento.complementosNaoTabelados as { descricao?: string }[] | undefined) ?? []
  return [...tabelados, ...naoTabelados]
    .map((c) => c.descricao ?? '')
    .filter(Boolean)
    .join('; ')
}

// ---------------------------------------------------------------------------
// Detecta se um movimento é audiência
// ---------------------------------------------------------------------------

const PALAVRAS_AUDIENCIA = ['audiência', 'audiencia', 'sessão', 'julgamento', 'instrução']

export function isAudiencia(movimento: DataJudMovimento): boolean {
  const nome = movimento.nome.toLowerCase()
  return PALAVRAS_AUDIENCIA.some((p) => nome.includes(p))
}
