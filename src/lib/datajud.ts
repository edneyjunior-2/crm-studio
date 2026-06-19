/**
 * datajud.ts — Utilitário para a API pública do DataJud (CNJ)
 *
 * Detecta automaticamente o tribunal a partir do número CNJ e busca
 * processo e movimentações via API REST do DataJud.
 *
 * Número CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO (20 dígitos sem pontuação)
 * J  = segmento judicial (posição 13)
 * TT = código do tribunal (posições 14-15)
 *
 * Chave de API: a API pública do DataJud usa uma chave pública documentada pelo
 * CNJ (https://datajud-wiki.cnj.jus.br/api-publica/acesso). Use DATAJUD_API_KEY
 * para sobrescrever; na ausência dela, caímos na chave pública oficial.
 */

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br'

// Chave pública oficial do DataJud (CNJ). É pública e pode ficar no código —
// serve como fallback quando DATAJUD_API_KEY não está configurada no ambiente.
const DATAJUD_PUBLIC_KEY =
  'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='
const DATAJUD_KEY = process.env.DATAJUD_API_KEY ?? DATAJUD_PUBLIC_KEY

const DATAJUD_TIMEOUT_MS = 8_000

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
  dataAjuizamento?:  string | null
  assunto?:          string
  vara?:             string
  comarca?:          string
  valor?:            number | null
  partes:            DataJudParte[]
  movimentos:        DataJudMovimento[]
}

/**
 * Resultado discriminado da busca. Distinguir os motivos de falha é essencial:
 * antes, qualquer erro (401, 429, rede) virava `null` indistinguível de "sem
 * resultado", mascarando bugs de configuração como "processo não encontrado".
 */
export type DataJudResult =
  | { ok: true;  processo: DataJudProcesso }
  | { ok: false; motivo: DataJudErro }

export type DataJudErro =
  | 'numero_invalido'   // não dá pra detectar o tribunal
  | 'nao_encontrado'    // tribunal respondeu 200 mas sem hits
  | 'auth'              // 401/403 — chave inválida/sem acesso (erro de configuração)
  | 'rate_limit'        // 429 — limite do DataJud (~120 req/min)
  | 'indisponivel'      // 5xx ou outro status — tribunal/serviço fora
  | 'rede'             // timeout, DNS, conexão recusada

const MENSAGEM_ERRO: Record<DataJudErro, string> = {
  numero_invalido: 'Número CNJ inválido — não foi possível identificar o tribunal.',
  nao_encontrado:  'Processo não encontrado no DataJud. Você pode cadastrá-lo manualmente.',
  auth:            'Falha de autenticação no DataJud. Verifique a configuração (DATAJUD_API_KEY).',
  rate_limit:      'Limite de consultas ao DataJud atingido. Aguarde alguns instantes e tente novamente.',
  indisponivel:    'O DataJud está temporariamente indisponível. Tente novamente mais tarde.',
  rede:            'Não foi possível conectar ao DataJud. Verifique a conexão e tente novamente.',
}

export function mensagemErroDataJud(motivo: DataJudErro): string {
  return MENSAGEM_ERRO[motivo]
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
): Promise<DataJudResult> {
  const slug    = tribunalSlug ?? detectarTribunal(numeroCNJ)
  const numero  = normalizarNumeroCNJ(numeroCNJ)        // pontuado — para exibir/retornar
  const numeroDigits = numeroCNJ.replace(/\D/g, '')      // 20 dígitos puros — para a API

  if (slug === 'desconhecido') return { ok: false, motivo: 'numero_invalido' }

  const url  = `${DATAJUD_BASE}/api_publica_${slug}/_search`
  // IMPORTANTE: o DataJud guarda numeroProcesso como 20 dígitos SEM pontuação.
  // Consultar com a forma pontuada retorna 0 hits — sempre buscar com dígitos puros.
  const body = JSON.stringify({
    query: { match: { numeroProcesso: numeroDigits } },
    size:  1,
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `APIKey ${DATAJUD_KEY}`,
        'Content-Type':  'application/json',
      },
      body,
      signal: controller.signal,
      cache:  'no-store',
    })
  } catch (err) {
    console.error(`[datajud] erro de rede ao consultar ${slug} (${numero}):`, err)
    return { ok: false, motivo: 'rede' }
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    console.error(`[datajud] HTTP ${res.status} ao consultar ${slug} (${numero})`)
    if (res.status === 401 || res.status === 403) return { ok: false, motivo: 'auth' }
    if (res.status === 429)                        return { ok: false, motivo: 'rate_limit' }
    return { ok: false, motivo: 'indisponivel' }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    console.error(`[datajud] resposta inválida (não-JSON) de ${slug} (${numero}):`, err)
    return { ok: false, motivo: 'indisponivel' }
  }

  const hit = (json as { hits?: { hits?: { _source?: Record<string, unknown> }[] } })
    ?.hits?.hits?.[0]?._source
  if (!hit) return { ok: false, motivo: 'nao_encontrado' }

  const orgao    = (hit.orgaoJulgador as { nome?: string } | undefined)?.nome ?? ''
  const assuntos = (hit.assuntos as { nome?: string }[] | undefined) ?? []
  const assunto  = assuntos[0]?.nome ?? ''

  const { vara, comarca } = extrairVaraComarca(orgao)

  // Mapeia movimentos, descartando os sem data válida (um movimento sem dataHora
  // geraria 'NaN-NaN-NaN' e derrubaria o batch inteiro no insert).
  const movimentos: DataJudMovimento[] = ((hit.movimentos as Record<string, unknown>[] | undefined) ?? [])
    .filter((m) => typeof m.dataHora === 'string' && !Number.isNaN(Date.parse(m.dataHora as string)))
    .map((m) => ({
      codigo:      (m.codigo as number) ?? 0,
      nome:        (m.nome as string) ?? '',
      dataHora:    m.dataHora as string,
      complemento: extrairComplemento(m),
    }))

  // valor da causa: o campo real do DataJud é 'valorCausa' (e costuma vir ausente).
  const valorCausaRaw = (hit.valorCausa ?? hit.valor) as unknown
  const valor = typeof valorCausaRaw === 'number' ? valorCausaRaw : null

  return {
    ok: true,
    processo: {
      numeroProcesso:  numero,
      tribunalSlug:    slug,
      dataAjuizamento: (hit.dataAjuizamento as string | undefined) ?? null,
      assunto,
      vara,
      comarca,
      valor,
      // A API pública do DataJud não retorna 'partes' (LGPD); fica sempre vazio.
      partes:    [],
      movimentos,
    },
  }
}

// Extrai vara e comarca do nome do órgão julgador.
// Ex.: "1ª Vara Cível de Salvador" → vara="1ª Vara Cível", comarca="Salvador"
//      "03 CIVEL DE SAO MIGUEL PAULISTA" → vara="03 CIVEL", comarca="SAO MIGUEL PAULISTA"
// Sem " de/da/do ", coloca tudo em vara e deixa comarca vazia.
function extrairVaraComarca(orgao: string): { vara: string; comarca: string } {
  if (!orgao) return { vara: '', comarca: '' }
  const m = orgao.match(/^(.+?)\s+d[eao]s?\s+(.+)$/i)
  if (m) return { vara: m[1].trim(), comarca: m[2].trim() }
  return { vara: orgao.trim(), comarca: '' }
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

const PALAVRAS_AUDIENCIA = ['audiência', 'audiencia']

export function isAudiencia(movimento: DataJudMovimento): boolean {
  const nome = movimento.nome.toLowerCase()
  return PALAVRAS_AUDIENCIA.some((p) => nome.includes(p))
}
