import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarProcessosLoteTribunal, type DataJudResult } from '@/lib/datajud'
import { sendNovasMovimentacoesEmail } from '@/lib/email'
import { verificarCronSecret } from '@/lib/cron-auth'

export const maxDuration = 800 // Vercel Pro c/ Fluid Compute — teto GA sem beta (2026-07)

// Throttle ENTRE TRIBUNAIS (não mais entre processos individuais — desde que
// passamos a usar a busca em lote, 1 chamada já cobre todos os processos de um
// tribunal na rodada). Mesmo valor de antes: limite público ~120 req/min → ~1 req/600ms.
const THROTTLE_MS = 600
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Vercel Cron invoca via GET; POST permite trigger manual autenticado
export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

type ProcessoRow = {
  id:              string
  numero_processo: string
  tribunal_slug:   string
  empresa_id:      string
  advogado_id:     string | null
  assunto:         string | null
}

// Acumula processos com novas movimentações para notificar ao final (evita rate-limit de e-mail no meio do loop)
type Notificacao = { advogadoId: string; processoId: string; numero: string; assunto: string | null; qtdNovas: number }

async function handler(req: NextRequest) {
  // Proteção por secret (comparação timing-safe — ver src/lib/cron-auth.ts)
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // Com a busca EM LOTE (1 request por tribunal, em vez de 1 por processo), o
  // custo por processo despenca — o gargalo deixa de ser N requests HTTP (cada
  // um pagando a latência/timeout do DataJud) e passa a ser N upserts no banco,
  // que são baratos. Subido de 14 → 300 (2026-07-14, ver spec
  // cron-datajud-em-lote.md): 300 processos ÷ ~200 por sub-lote
  // (DATAJUD_LOTE_MAX em datajud.ts) ≈ no máximo 2 requests por tribunal no
  // pior caso; os upserts de movimentações de 300 processos cabem folgados nos
  // 800s de maxDuration do cron.
  const LOTE_CRON = 300
  const { data: processos, error } = await db
    .from('processos_juridicos')
    .select('id, numero_processo, tribunal_slug, empresa_id, advogado_id, assunto')
    .eq('status', 'em_transito')
    .order('ultimo_datajud_update', { ascending: true, nullsFirst: true })
    .limit(LOTE_CRON)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!processos || processos.length === 0) {
    return NextResponse.json({ atualizados: 0, novas_movimentacoes: 0 })
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
      return NextResponse.json(
        { error: 'DataJud: falha de autenticação (verifique DATAJUD_API_KEY)', atualizados, novas_movimentacoes: novasTotais },
        { status: 502 },
      )
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
      console.error('[cron] falha ao enviar e-mails de movimentação:', err)
    }
  }

  return NextResponse.json({
    atualizados,
    novas_movimentacoes: novasTotais,
    ...(erros.length ? { erros } : {}),
  })
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
      descricao:         m.nome,
      complemento:       m.complemento || null,
      data_movimentacao: dataMovimentacao,
      lido:              false,
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

  // Registra processo com novas movimentações para e-mail ao responsável
  if (qtdNovas > 0 && processo.advogado_id) {
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
