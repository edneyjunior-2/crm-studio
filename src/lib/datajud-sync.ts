import { createAdminClient } from '@/lib/supabase/admin'
import { buscarProcessosLoteTribunal, type DataJudResult } from '@/lib/datajud'
import { sendNovasMovimentacoesEmail } from '@/lib/email'

// Throttle ENTRE TRIBUNAIS (não mais entre processos individuais — desde que
// passamos a usar a busca em lote, 1 chamada já cobre todos os processos de um
// tribunal na rodada). Mesmo valor de antes: limite público ~120 req/min → ~1 req/600ms.
const THROTTLE_MS = 600
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type ProcessoRow = {
  id:                    string
  numero_processo:       string
  tribunal_slug:         string
  empresa_id:            string
  advogado_id:           string | null
  assunto:               string | null
  ultimo_datajud_update: string | null
}

// Acumula processos com novas movimentações para notificar ao final (evita rate-limit de e-mail no meio do loop)
type Notificacao = { advogadoId: string; processoId: string; numero: string; assunto: string | null; qtdNovas: number }

/**
 * Sincroniza movimentações do DataJud para os processos em `em_transito`.
 * Extraída 1:1 do handler de `src/app/api/cron/atualizar-processos/route.ts`
 * (ver spec `admin-sincronizar-processos-botao.md`) — o cron (limite 300) e a
 * rota admin (limite maior, pra drenar backlog) chamam a mesma função.
 *
 * Tradução do tratamento HTTP pro formato de lib (a função não é uma rota,
 * não pode devolver Response):
 * - erro ao BUSCAR os processos (falha de query): lança — o caller HTTP
 *   traduz pra 500, igual ao `return NextResponse.json({error}, {status:500})`
 *   de antes.
 * - motivo 'auth' uniforme num tribunal (chave DataJud inválida/sem acesso):
 *   registra uma entrada reconhecível em `erros` (prefixo `'auth:'`) e
 *   RETORNA IMEDIATAMENTE — sem processar os tribunais restantes nem enviar
 *   e-mails. Mesma interrupção total de antes; o wrapper do cron detecta o
 *   prefixo e devolve 502 com a mesma mensagem de sempre.
 * - motivo 'rate_limit' uniforme: registra o erro, interrompe o loop de
 *   tribunais (break) mas SEGUE pro envio de e-mails e retorno normal —
 *   igual a antes (reporta o parcial).
 */
export async function sincronizarMovimentacoesDataJud(
  db: ReturnType<typeof createAdminClient>,
  opts?: { limite?: number },
): Promise<{ atualizados: number; novasMovimentacoes: number; erros: string[] }> {
  // Com a busca EM LOTE (1 request por tribunal, em vez de 1 por processo), o
  // custo por processo despenca — o gargalo deixa de ser N requests HTTP (cada
  // um pagando a latência/timeout do DataJud) e passa a ser N upserts no banco,
  // que são baratos. Subido de 14 → 300 (2026-07-14, ver spec
  // cron-datajud-em-lote.md): 300 processos ÷ ~200 por sub-lote
  // (DATAJUD_LOTE_MAX em datajud.ts) ≈ no máximo 2 requests por tribunal no
  // pior caso; os upserts de movimentações de 300 processos cabem folgados nos
  // 800s de maxDuration do cron.
  const limite = opts?.limite ?? 300
  const { data: processos, error } = await db
    .from('processos_juridicos')
    .select('id, numero_processo, tribunal_slug, empresa_id, advogado_id, assunto, ultimo_datajud_update')
    .eq('status', 'em_transito')
    .order('ultimo_datajud_update', { ascending: true, nullsFirst: true })
    .limit(limite)

  if (error) {
    throw new Error(error.message)
  }

  if (!processos || processos.length === 0) {
    return { atualizados: 0, novasMovimentacoes: 0, erros: [] }
  }

  let atualizados = 0
  let novasTotais = 0
  const erros: string[] = []
  const notificacoes: Notificacao[] = []

  // Agrupa por tribunal_slug — a busca em lote consulta todos os processos de
  // um mesmo tribunal numa única requisição.
  const porTribunal = new Map<string, ProcessoRow[]>()
  for (const p of processos as ProcessoRow[]) {
    const lista = porTribunal.get(p.tribunal_slug)
    if (lista) lista.push(p)
    else porTribunal.set(p.tribunal_slug, [p])
  }

  let i = 0
  for (const [slug, procs] of porTribunal) {
    if (i > 0) await sleep(THROTTLE_MS)
    i++

    const numeros = procs.map((p) => p.numero_processo)
    let resultados: Map<string, DataJudResult>
    try {
      resultados = await buscarProcessosLoteTribunal(numeros, slug)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`${slug}: ${msg}`)
      continue
    }

    // buscarSubLote (em datajud.ts) propaga o MESMO DataJudResult de erro pra
    // todos os números de um sub-lote em caso de falha. Se todo o tribunal
    // veio com o mesmo motivo auth/rate_limit, é o run inteiro que está com
    // problema (erro de configuração ou limite global), não os processos —
    // mesmo tratamento de hoje.
    const motivos = new Set(
      procs.map((p) => {
        const r = resultados.get(p.numero_processo)
        return r && !r.ok ? r.motivo : null
      }),
    )
    const motivoUniforme = motivos.size === 1 ? [...motivos][0] : null

    if (motivoUniforme === 'auth') {
      // auth = chave inválida/sem acesso → erro de configuração: abortar o run
      // inteiro (não adianta consultar os demais tribunais e ainda estoura rate limit).
      erros.push('auth: falha de autenticação (verifique DATAJUD_API_KEY)')
      return { atualizados, novasMovimentacoes: novasTotais, erros }
    }
    if (motivoUniforme === 'rate_limit') {
      // rate_limit → encerrar e reportar o que já foi feito; o próximo run continua.
      erros.push('rate_limit atingido — interrompido')
      break
    }

    for (const processo of procs) {
      const res = resultados.get(processo.numero_processo)
      if (!res) {
        erros.push(`${processo.numero_processo}: sem resultado do lote`)
        continue
      }
      try {
        const r = await processarResultado(db, processo, res, notificacoes)
        if (r.atualizado) atualizados++
        if (r.erro) erros.push(r.erro)
        novasTotais += r.qtdNovas
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        erros.push(`${processo.numero_processo}: ${msg}`)
      }
    }
  }

  // Envia e-mails de alerta para os responsáveis com novas movimentações
  if (notificacoes.length > 0) {
    try {
      // Busca e-mail e nome de cada advogado único — 2 queries em lote (não N+1).
      // Usa a view profiles_auth p/ o e-mail (getUserById voltava vazio em prod).
      const uniqueIds = [...new Set(notificacoes.map((n) => n.advogadoId))]
      const advMap: Record<string, { email: string; nome: string }> = {}

      if (uniqueIds.length > 0) {
        const [{ data: authRows }, { data: perfilRows }] = await Promise.all([
          db.from('profiles_auth').select('id, email').in('id', uniqueIds),
          db.from('profiles').select('id, full_name').in('id', uniqueIds),
        ])
        const nomeMap = new Map(
          (perfilRows ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null])
        )
        for (const r of authRows ?? []) {
          const email = r.email as string | null
          if (email) {
            advMap[r.id as string] = {
              email,
              nome: nomeMap.get(r.id as string) ?? email.split('@')[0],
            }
          }
        }
      }

      await Promise.all(
        notificacoes.map((n) => {
          const adv = advMap[n.advogadoId]
          if (!adv) return Promise.resolve()
          return sendNovasMovimentacoesEmail({
            to:             adv.email,
            nomeAdvogado:   adv.nome,
            numeroProcesso: n.numero,
            assunto:        n.assunto,
            qtdNovas:       n.qtdNovas,
            processoId:     n.processoId,
          })
        })
      )
    } catch (err) {
      console.error('[datajud-sync] falha ao enviar e-mails de movimentação:', err)
    }
  }

  return { atualizados, novasMovimentacoes: novasTotais, erros }
}

// Processa o DataJudResult de UM processo: carimba ultimo_datajud_update
// quando aplicável, mapeia/dedupe movimentos e faz o upsert. Extraída do loop
// que hoje é por-tribunal (ver spec cron-datajud-em-lote.md) — mesma lógica
// que já existia inline, só isolada pra não duplicar entre tribunais.
async function processarResultado(
  db: ReturnType<typeof createAdminClient>,
  processo: ProcessoRow,
  res: DataJudResult,
  notificacoes: Notificacao[],
): Promise<{ atualizado: boolean; erro: string | null; qtdNovas: number }> {
  // Capturado ANTES de qualquer carimbo de ultimo_datajud_update neste sync —
  // é o sinal de "processo nunca sincronizado antes" (backfill histórico).
  // Movimentações de anos atrás descobertas agora não são "novidade" pro
  // usuário; mesmo tratamento que processos/novo/actions.ts já dá ao
  // cadastro manual (lido:true, sem e-mail).
  const primeiraSincronizacao = processo.ultimo_datajud_update === null

  if (!res.ok) {
    if (res.motivo === 'nao_encontrado') {
      // Processo não indexado no DataJud ainda — marca como verificado hoje
      // para não ficar no topo da fila a cada rodada.
      await db
        .from('processos_juridicos')
        .update({ ultimo_datajud_update: new Date().toISOString() })
        .eq('id', processo.id)
      return { atualizado: false, erro: null, qtdNovas: 0 }
    }
    // rede/indisponivel (auth/rate_limit uniformes já tratados no chamador,
    // por tribunal) — NÃO carimba, pra não mascarar; próxima rodada tenta de novo.
    return { atualizado: false, erro: `${processo.numero_processo}: ${res.motivo}`, qtdNovas: 0 }
  }

  // Encontrado mas sem movimentos: marca como verificado assim mesmo
  if (!res.processo.movimentos.length) {
    await db
      .from('processos_juridicos')
      .update({ ultimo_datajud_update: new Date().toISOString() })
      .eq('id', processo.id)
    return { atualizado: true, erro: null, qtdNovas: 0 }
  }

  // Mapear movimentações para inserção (datajud.ts já filtrou datas inválidas)
  const movsRaw = res.processo.movimentos.map((m) => {
    const d = new Date(m.dataHora)
    const dataMovimentacao =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      processo_id:       processo.id,
      empresa_id:        processo.empresa_id,
      codigo_movimento:  m.codigo,
      // Alguns tribunais devolvem `nome` vazio pra certos códigos (ex.: 15246) —
      // sem fallback, vira uma linha em branco na timeline (parece corrompida).
      descricao:         m.nome?.trim() || `Movimentação (código ${m.codigo ?? '?'})`,
      complemento:       m.complemento || null,
      data_movimentacao: dataMovimentacao,
      lido:              primeiraSincronizacao,
      raw_data:          m,
    }
  })

  // Deduplica por chave composta (processo_id|codigo_movimento|data_movimentacao)
  // para evitar "ON CONFLICT DO UPDATE command cannot affect row a second time"
  // quando o DataJud devolve 2 movimentos do mesmo código/dia no mesmo processo.
  const movsDedup = new Map<string, typeof movsRaw[number]>()
  for (const mov of movsRaw) {
    const key = `${mov.processo_id}|${mov.codigo_movimento}|${mov.data_movimentacao}`
    movsDedup.set(key, mov)
  }
  const movs = Array.from(movsDedup.values())

  // Upsert com ON CONFLICT DO NOTHING — só insere movimentações genuinamente novas
  const { data: inserted, error: errMovs } = await db
    .from('movimentacoes_processo')
    .upsert(movs, {
      onConflict:       'processo_id,codigo_movimento,data_movimentacao',
      ignoreDuplicates: true,
    })
    .select('id')

  if (errMovs) {
    return { atualizado: false, erro: `${processo.numero_processo}: ${errMovs.message}`, qtdNovas: 0 }
  }

  const qtdNovas = inserted?.length ?? 0

  // Registra processo com novas movimentações para e-mail ao responsável —
  // não no backfill inicial (AC4): não é "notícia" pro advogado, é histórico.
  if (qtdNovas > 0 && processo.advogado_id && !primeiraSincronizacao) {
    notificacoes.push({
      advogadoId: processo.advogado_id,
      processoId: processo.id,
      numero:     processo.numero_processo,
      assunto:    processo.assunto,
      qtdNovas,
    })
  }

  // Atualiza timestamp de última consulta DataJud
  await db
    .from('processos_juridicos')
    .update({ ultimo_datajud_update: new Date().toISOString() })
    .eq('id', processo.id)

  return { atualizado: true, erro: null, qtdNovas }
}
