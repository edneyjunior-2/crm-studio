/**
 * djen.ts — Cliente de integração com a API pública do DJEN
 * (Diário de Justiça Eletrônico Nacional, CNJ).
 *
 * Endpoint público, sem autenticação:
 *   GET https://comunicaapi.pje.jus.br/api/v1/comunicacao
 *   query: numeroOab, ufOab, dataDisponibilizacaoInicio, dataDisponibilizacaoFim,
 *          itensPorPagina, pagina
 *
 * Rate limit: comportamento tipo token-bucket (~20 de teto, refill rápido em
 * segundos, não janela fixa por minuto). Nunca confirmamos 429 em teste com
 * chamadas espaçadas, mas implementamos backoff exponencial por precaução —
 * não assumir cota fixa.
 */

import { normalizarNumeroCNJ } from './datajud'

const DJEN_BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'

const DJEN_TIMEOUT_MS = 15_000
const DJEN_MAX_TENTATIVAS_429 = 3
const DJEN_BACKOFF_BASE_MS = 1_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DjenAdvogadoDestinatario {
  numeroOab: string
  ufOab: string
  nome: string
}

export interface DjenPublicacao {
  id:                  number
  dataDisponibilizacao: string
  siglaTribunal:       string
  tipoComunicacao:     string
  texto:               string
  numeroProcesso:      string | null
  link:                string | null
  advogados:           DjenAdvogadoDestinatario[]
}

export type DjenResult =
  | { ok: true;  publicacoes: DjenPublicacao[] }
  | { ok: false; motivo: DjenErro }

export type DjenErro =
  | 'rate_limit'    // 429 mesmo após as tentativas de backoff
  | 'indisponivel'  // 5xx ou outro status HTTP inesperado
  | 'rede'          // timeout, DNS, conexão recusada

const MENSAGEM_ERRO: Record<DjenErro, string> = {
  rate_limit:   'Limite de consultas ao DJEN atingido. Tente novamente em alguns instantes.',
  indisponivel: 'O DJEN está temporariamente indisponível. Tente novamente mais tarde.',
  rede:         'Não foi possível conectar ao DJEN. Verifique a conexão e tente novamente.',
}

export function mensagemErroDjen(motivo: DjenErro): string {
  return MENSAGEM_ERRO[motivo]
}

// ---------------------------------------------------------------------------
// Shape bruto da resposta da API (só os campos que usamos)
// ---------------------------------------------------------------------------

interface DjenApiAdvogado {
  advogado_id?: number
  advogado?: { id?: number; nome?: string; numero_oab?: string; uf_oab?: string }
}

interface DjenApiItem {
  id: number
  data_disponibilizacao: string
  siglaTribunal?: string
  tipoComunicacao?: string
  texto?: string
  numero_processo?: string
  link?: string
  destinatarioadvogados?: DjenApiAdvogado[]
}

interface DjenApiResponse {
  status?: string
  count?: number
  items?: DjenApiItem[]
}

function mapearItem(item: DjenApiItem): DjenPublicacao {
  const advogados: DjenAdvogadoDestinatario[] = (item.destinatarioadvogados ?? [])
    .map((d) => ({
      numeroOab: d.advogado?.numero_oab ?? '',
      ufOab:     d.advogado?.uf_oab ?? '',
      nome:      d.advogado?.nome ?? '',
    }))
    .filter((a) => a.numeroOab)

  return {
    id:                    item.id,
    dataDisponibilizacao:  item.data_disponibilizacao,
    siglaTribunal:         item.siglaTribunal ?? '',
    tipoComunicacao:       item.tipoComunicacao ?? '',
    texto:                 item.texto ?? '',
    numeroProcesso:        item.numero_processo || null,
    link:                  item.link || null,
    advogados,
  }
}

// ---------------------------------------------------------------------------
// Busca publicações no DJEN por OAB + UF, com paginação e backoff em 429
// ---------------------------------------------------------------------------

/**
 * Busca todas as publicações de um advogado (OAB + UF) desde a data `desde`
 * (inclusive) até hoje. Pagina automaticamente até esgotar os resultados.
 */
export async function buscarPublicacoesDJEN({
  numeroOab,
  ufOab,
  desde,
}: {
  numeroOab: string
  ufOab: string
  desde: string // 'YYYY-MM-DD'
}): Promise<DjenResult> {
  const ITENS_POR_PAGINA = 100
  const publicacoes: DjenPublicacao[] = []
  let pagina = 1

  for (;;) {
    const url = new URL(DJEN_BASE)
    url.searchParams.set('numeroOab', numeroOab)
    url.searchParams.set('ufOab', ufOab)
    url.searchParams.set('dataDisponibilizacaoInicio', desde)
    url.searchParams.set('itensPorPagina', String(ITENS_POR_PAGINA))
    url.searchParams.set('pagina', String(pagina))

    const res = await fetchComBackoff(url)
    if (!res.ok) return res

    const itens = res.itens
    publicacoes.push(...itens.map(mapearItem))

    // Última página: veio menos que o tamanho pedido (ou nada).
    if (itens.length < ITENS_POR_PAGINA) break
    pagina++
  }

  return { ok: true, publicacoes }
}

async function fetchComBackoff(
  url: URL,
): Promise<{ ok: true; itens: DjenApiItem[] } | { ok: false; motivo: DjenErro }> {
  for (let tentativa = 0; tentativa <= DJEN_MAX_TENTATIVAS_429; tentativa++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DJEN_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    } catch (err) {
      console.error(`[djen] erro de rede ao consultar ${url.toString()}:`, err)
      return { ok: false, motivo: 'rede' }
    } finally {
      clearTimeout(timeout)
    }

    if (res.status === 429) {
      if (tentativa === DJEN_MAX_TENTATIVAS_429) {
        console.error(`[djen] 429 persistente após ${tentativa} tentativas: ${url.toString()}`)
        return { ok: false, motivo: 'rate_limit' }
      }
      const espera = DJEN_BACKOFF_BASE_MS * 2 ** tentativa
      console.warn(`[djen] 429 recebido, aguardando ${espera}ms antes de tentar de novo (tentativa ${tentativa + 1})`)
      await sleep(espera)
      continue
    }

    if (!res.ok) {
      console.error(`[djen] HTTP ${res.status} ao consultar ${url.toString()}`)
      return { ok: false, motivo: 'indisponivel' }
    }

    let json: DjenApiResponse
    try {
      json = (await res.json()) as DjenApiResponse
    } catch (err) {
      console.error(`[djen] resposta inválida (não-JSON) de ${url.toString()}:`, err)
      return { ok: false, motivo: 'indisponivel' }
    }

    return { ok: true, itens: json.items ?? [] }
  }

  // Inalcançável (o loop sempre retorna ou continua até o limite), mas o
  // TypeScript exige um retorno explícito no fim da função.
  return { ok: false, motivo: 'rate_limit' }
}

// ---------------------------------------------------------------------------
// Matching + montagem das linhas para persistência (puro — sem acesso a banco;
// reaproveitado pelo cron e pela rota de sync manual)
// ---------------------------------------------------------------------------

export interface PublicacaoParaSalvar {
  djen_id:                number
  empresa_id:             string
  advogado_id:            string
  processo_id:            string | null
  data_disponibilizacao:  string
  sigla_tribunal:         string | null
  tipo_comunicacao:       string | null
  texto:                  string
  numero_processo_cnj:    string | null
  link:                   string | null
  raw_data:               DjenPublicacao
}

/**
 * Monta as linhas prontas para upsert em `publicacoes_processo`, casando cada
 * publicação com um processo da mesma empresa via CNJ normalizado
 * (`normalizarNumeroCNJ`, reaproveitado de src/lib/datajud.ts — não duplicado
 * aqui). Publicação sem `numero_processo` reconhecível, ou sem processo
 * correspondente cadastrado, ainda é retornada — só com `processo_id = null`
 * (nunca é descartada).
 */
export function montarPublicacoesParaSalvar({
  publicacoes,
  empresaId,
  advogadoId,
  resolverProcessoId,
}: {
  publicacoes: DjenPublicacao[]
  empresaId: string
  advogadoId: string
  /** Dado o número CNJ já normalizado, retorna o id do processo correspondente (ou null). */
  resolverProcessoId: (numeroCnjNormalizado: string) => string | null
}): PublicacaoParaSalvar[] {
  return publicacoes.map((p) => {
    const numeroCnj = p.numeroProcesso ? normalizarNumeroCNJ(p.numeroProcesso) : null
    const processoId = numeroCnj ? resolverProcessoId(numeroCnj) : null
    return {
      djen_id:               p.id,
      empresa_id:            empresaId,
      advogado_id:           advogadoId,
      processo_id:           processoId,
      data_disponibilizacao: p.dataDisponibilizacao,
      sigla_tribunal:        p.siglaTribunal || null,
      tipo_comunicacao:      p.tipoComunicacao || null,
      texto:                 p.texto,
      numero_processo_cnj:   numeroCnj,
      link:                  p.link,
      raw_data:              p,
    }
  })
}

// ---------------------------------------------------------------------------
// Helper de data local (sem toISOString — evita deslocamento de fuso)
// ---------------------------------------------------------------------------

/** Formata uma Date como 'YYYY-MM-DD' usando componentes locais. */
export function formatarDataLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Janela de busca da PRIMEIRA sincronização de um advogado (nunca rodou
 * antes): 30 dias corridos para trás. Escolha arbitrária e razoável — cobre
 * prazos recursais comuns sem trazer histórico excessivo na carga inicial.
 */
export const JANELA_INICIAL_DIAS = 30

/** Data (YYYY-MM-DD) de N dias atrás, em horário local. */
export function dataNDiasAtras(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return formatarDataLocal(d)
}
