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

// 15s: medido em 2026-07-07 contra a API pública real (tjba, tjgo, tjsp) —
// respostas variaram de 4s a 15s no mesmo request repetido. 8s causava aborts
// em massa específicos de tribunais mais lentos (523 timeouts/24h só no tjba),
// deixando processos desses tribunais permanentemente sem sincronizar.
const DATAJUD_TIMEOUT_MS = 15_000

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
  /** Área do direito inferida (enum do app) ou '' quando não foi possível inferir. */
  area?:             string
  vara?:             string
  comarca?:          string
  valor?:            number | null
  partes:            DataJudParte[]
  movimentos:        DataJudMovimento[]
}

// Áreas do app (mesmo enum do form/detalhe): civel | trabalhista | criminal |
// previdenciario | tributario | administrativo | familia | outro.
// Classificador best-effort por palavras-chave na classe + assuntos (textos
// legíveis do DataJud) + heurística do tribunal. Ordem importa: áreas
// específicas antes de 'civel' (que é o guarda-chuva). Retorna '' se incerto
// (o usuário preenche/ajusta na mão).
const AREA_KEYWORDS: { area: string; termos: string[] }[] = [
  { area: 'trabalhista',    termos: ['trabalh', 'reclamatóri', 'reclamatori', 'verbas rescis', 'fgts', 'aviso prévio', 'horas extras', 'vínculo empregat', 'vinculo empregat'] },
  { area: 'tributario',     termos: ['execução fiscal', 'execucao fiscal', 'tribut', 'dívida ativa', 'divida ativa', 'iptu', 'icms', 'iss ', 'imposto', 'cobrança administrativa', 'cobranca administrativa', 'taxa', 'contribuição', 'contribuicao'] },
  { area: 'previdenciario', termos: ['previdenc', 'aposentadoria', 'auxílio-doença', 'auxilio-doenca', 'auxílio-acidente', 'benefício assistencial', 'beneficio assistencial', 'salário-maternidade', 'salario-maternidade', 'pensão por morte', 'pensao por morte', 'inss', 'loas', 'bpc'] },
  { area: 'criminal',       termos: ['penal', 'criminal', 'crime', 'inquérito', 'inquerito', 'habeas corpus', 'flagrante', 'execução penal', 'execucao penal', 'delito', 'contravenção', 'contravencao'] },
  { area: 'familia',        termos: ['família', 'familia', 'divórcio', 'divorcio', 'alimentos', 'guarda', 'inventário', 'inventario', 'união estável', 'uniao estavel', 'partilha', 'sucess', 'curatela', 'tutela', 'adoção', 'adocao', 'reconhecimento de paternidade'] },
  { area: 'administrativo', termos: ['administrativ', 'servidor públic', 'servidor public', 'licitaç', 'licitac', 'improbidade', 'concurso públic', 'concurso public', 'desapropriaç', 'desapropriac', 'poder públic', 'poder public'] },
  { area: 'civel',          termos: ['cível', 'civel', 'indeniz', 'reparação de danos', 'reparacao de danos', 'cobrança', 'cobranca', 'contrat', 'consumidor', 'despejo', 'usucapião', 'usucapiao', 'busca e apreensão', 'busca e apreensao', 'monitóri', 'monitori', 'execução de título', 'execucao de titulo', 'danos morais', 'danos materiais'] },
]

export function inferirAreaDireito(
  classeNome: string,
  assuntosNomes: string[],
  tribunalSlug: string,
): string {
  const texto = [classeNome, ...assuntosNomes].join(' · ').toLowerCase()

  for (const { area, termos } of AREA_KEYWORDS) {
    if (termos.some((t) => texto.includes(t))) return area
  }

  // Heurística por segmento do tribunal quando o texto não bastou.
  if (tribunalSlug.startsWith('trt')) return 'trabalhista'   // Justiça do Trabalho

  return '' // incerto → deixa para o usuário escolher
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

  return { ok: true, processo: parseHitParaProcesso(hit, slug, numero) }
}

// Extrai um DataJudProcesso a partir de um `_source` de hit do Elasticsearch.
// Compartilhada pela busca individual e pela busca em lote — mesmo miolo,
// pra não duplicar o parsing de órgão/assuntos/classe/área/vara/comarca/
// movimentos/valor em dois lugares.
function parseHitParaProcesso(
  hit: Record<string, unknown>,
  slug: string,
  numeroProcesso: string,
): DataJudProcesso {
  const orgao    = (hit.orgaoJulgador as { nome?: string } | undefined)?.nome ?? ''
  const assuntos = (hit.assuntos as { nome?: string }[] | undefined) ?? []
  const assunto  = assuntos[0]?.nome ?? ''
  const classe   = (hit.classe as { nome?: string } | undefined)?.nome ?? ''
  const area     = inferirAreaDireito(classe, assuntos.map((a) => a.nome ?? ''), slug)

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
    numeroProcesso,
    tribunalSlug:    slug,
    dataAjuizamento: (hit.dataAjuizamento as string | undefined) ?? null,
    assunto,
    area,
    vara,
    comarca,
    valor,
    // A API pública do DataJud não retorna 'partes' (LGPD); fica sempre vazio.
    partes:    [],
    movimentos,
  }
}

// ---------------------------------------------------------------------------
// Busca em lote (vários processos do MESMO tribunal numa única requisição)
// ---------------------------------------------------------------------------

const DATAJUD_LOTE_MAX = 200 // teto conservador — ver spec (DataJud aceita até 10k/página)

// 90s: separado do timeout individual (15s) e sempre MAIOR que ele — invariante
// obrigatória (ver spec cron-datajud-em-lote.md). Query `terms` com muitos
// processos tem payload maior e o tjba respondeu até 32s em medição real; 90s
// dá folga generosa e ainda cabe folgado nos 800s de maxDuration do cron.
const DATAJUD_LOTE_TIMEOUT_MS = 90_000

// Throttle entre sub-lotes (só entra em jogo quando numerosCNJ.length > 200 e
// há mais de uma requisição sequencial) — mesmo valor usado pelo cron entre
// consultas individuais, pra não estourar o limite público (~120 req/min).
const DATAJUD_LOTE_THROTTLE_MS = 600
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function buscarProcessosLoteTribunal(
  numerosCNJ: string[],
  tribunalSlug: string,
): Promise<Map<string, DataJudResult>> {
  const resultado = new Map<string, DataJudResult>()
  if (numerosCNJ.length === 0) return resultado

  for (let i = 0; i < numerosCNJ.length; i += DATAJUD_LOTE_MAX) {
    if (i > 0) await sleep(DATAJUD_LOTE_THROTTLE_MS)
    const subLote = numerosCNJ.slice(i, i + DATAJUD_LOTE_MAX)
    await buscarSubLote(subLote, tribunalSlug, resultado)
  }

  return resultado
}

// Consulta um único sub-lote (<= DATAJUD_LOTE_MAX números) e grava no Map
// compartilhado — em caso de erro, o mesmo DataJudResult de erro é gravado
// para TODOS os números do sub-lote (nenhum fica sem entrada).
async function buscarSubLote(
  numerosOriginais: string[],
  slug: string,
  resultado: Map<string, DataJudResult>,
): Promise<void> {
  const porDigitos = new Map<string, string[]>() // dígitos puros → números originais (pode repetir)
  for (const original of numerosOriginais) {
    const digits = original.replace(/\D/g, '')
    const lista = porDigitos.get(digits)
    if (lista) lista.push(original)
    else porDigitos.set(digits, [original])
  }
  const numerosDigits = [...porDigitos.keys()]

  const gravarErroEmTodos = (motivo: DataJudErro) => {
    for (const original of numerosOriginais) resultado.set(original, { ok: false, motivo })
  }

  const url  = `${DATAJUD_BASE}/api_publica_${slug}/_search`
  const body = JSON.stringify({
    query: { terms: { numeroProcesso: numerosDigits } },
    size:  numerosDigits.length,
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DATAJUD_LOTE_TIMEOUT_MS)

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
    console.error(`[datajud] erro de rede ao consultar lote de ${slug} (${numerosOriginais.length} processos):`, err)
    gravarErroEmTodos('rede')
    return
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    console.error(`[datajud] HTTP ${res.status} ao consultar lote de ${slug} (${numerosOriginais.length} processos)`)
    if (res.status === 401 || res.status === 403) gravarErroEmTodos('auth')
    else if (res.status === 429)                  gravarErroEmTodos('rate_limit')
    else                                           gravarErroEmTodos('indisponivel')
    return
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    console.error(`[datajud] resposta inválida (não-JSON) do lote de ${slug} (${numerosOriginais.length} processos):`, err)
    gravarErroEmTodos('indisponivel')
    return
  }

  const hits = (json as { hits?: { hits?: { _source?: Record<string, unknown> }[] } })
    ?.hits?.hits ?? []

  const digitsEncontrados = new Set<string>()
  for (const h of hits) {
    const source = h._source
    if (!source) continue
    const numeroHitDigits = String(source.numeroProcesso ?? '').replace(/\D/g, '')
    const originais = porDigitos.get(numeroHitDigits)
    if (!originais) continue // hit não corresponde a nenhum número pedido (não deveria acontecer)
    digitsEncontrados.add(numeroHitDigits)
    const processo = parseHitParaProcesso(source, slug, normalizarNumeroCNJ(numeroHitDigits))
    for (const original of originais) resultado.set(original, { ok: true, processo })
  }

  // Números consultados que não vieram em nenhum hit → não encontrado.
  for (const [digits, originais] of porDigitos) {
    if (digitsEncontrados.has(digits)) continue
    for (const original of originais) resultado.set(original, { ok: false, motivo: 'nao_encontrado' })
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

// Rótulos acentuados para os campos de complemento mais comuns do DataJud
// (a API manda o nome do campo em snake_case e sem acento).
const ROTULOS_COMPLEMENTO: Record<string, string> = {
  tipo_de_documento:                   'Tipo de documento',
  tipo_de_peticao:                     'Tipo de petição',
  tipo_de_conclusao:                   'Tipo de conclusão',
  tipo_de_distribuicao_redistribuicao: 'Tipo de distribuição',
  tipo_de_audiencia:                   'Tipo de audiência',
  motivo_da_remessa:                   'Motivo da remessa',
  motivo_do_cancelamento:              'Motivo do cancelamento',
  tipo_de_decisao:                     'Tipo de decisão',
  tipo_de_remessa:                     'Tipo de remessa',
  tipo_de_baixa:                       'Tipo de baixa',
}

// "tipo_de_documento" → "Tipo de documento" (com acento quando conhecido)
function humanizarCampo(campo: string): string {
  if (ROTULOS_COMPLEMENTO[campo]) return ROTULOS_COMPLEMENTO[campo]
  const s = campo.replace(/_/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function extrairComplemento(movimento: Record<string, unknown>): string {
  const tabelados    = (movimento.complementosTabelados as { nome?: string; descricao?: string }[] | undefined) ?? []
  const naoTabelados = (movimento.complementosNaoTabelados as { nome?: string; descricao?: string }[] | undefined) ?? []

  const partes: string[] = []
  for (const c of tabelados) {
    // No complemento TABELADO, o valor real está em `nome` (ex.: "Decisão");
    // `descricao` é só o nome do campo (ex.: "tipo_de_documento").
    const valor = (c.nome ?? '').trim()
    const campo = humanizarCampo(c.descricao ?? '')
    if (valor && campo) partes.push(`${campo}: ${valor}`)
    else if (valor) partes.push(valor)
  }
  for (const c of naoTabelados) {
    // Não-tabelado = texto livre (em `nome` ou `descricao`).
    const txt = (c.nome ?? c.descricao ?? '').trim()
    if (txt) partes.push(txt)
  }
  return partes.join('; ')
}

