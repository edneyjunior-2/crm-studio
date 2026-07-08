import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarProcessoDataJud } from '@/lib/datajud'
import { sendNovasMovimentacoesEmail } from '@/lib/email'
import { verificarCronSecret } from '@/lib/cron-auth'

export const maxDuration = 300 // 5 min (Vercel Pro)

// Throttle entre consultas ao DataJud (limite público ~120 req/min → ~1 req/600ms).
const THROTTLE_MS = 600
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Vercel Cron invoca via GET; POST permite trigger manual autenticado
export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

async function handler(req: NextRequest) {
  // Proteção por secret (comparação timing-safe — ver src/lib/cron-auth.ts)
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // Processa os 14 mais desatualizados por rodada (NULLS FIRST = nunca sincronizados antes).
  // Reduzido de 18 (2026-07-08): medição real contra o TJBA mostrou latência de
  // 7-12s por request MESMO em respostas bem-sucedidas (não é só o caso-limite de
  // 15s do timeout) — a estimativa anterior (18 × 15,6s ≈ 281s, quase no teto de
  // 300s do maxDuration) não tinha folga pra absorver isso mais o overhead real de
  // parsing/upsert de dezenas de movimentos por processo. Um cluster de 44
  // processos TJBA ficou preso há dias porque toda rodada os selecionava juntos
  // (por serem os "mais antigos") e a função provavelmente estourava o teto e era
  // morta pela Vercel no meio do lote, sem nunca gravar ultimo_datajud_update —
  // reprocessando o mesmo cluster travado pra sempre. 14 × (15s timeout + 600ms
  // throttle) ≈ 218s, com ~82s de folga real. Com cron a cada 30 min: 262
  // processos ÷ 14 por rodada ≈ 19 rodadas → cabe no mesmo dia dentro da janela
  // de 11h, só um pouco mais devagar que antes.
  const LOTE_CRON = 14
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

  let atualizados    = 0
  let novasTotais    = 0
  const erros: string[] = []
  let i = 0

  // Acumula processos com novas movimentações para notificar ao final (evita rate-limit de e-mail no meio do loop)
  type Notificacao = { advogadoId: string; processoId: string; numero: string; assunto: string | null; qtdNovas: number }
  const notificacoes: Notificacao[] = []

  for (const processo of processos) {
    if (i > 0) await sleep(THROTTLE_MS)
    i++

    try {
      const res = await buscarProcessoDataJud(
        processo.numero_processo,
        processo.tribunal_slug,
      )

      if (!res.ok) {
        // auth = chave inválida/sem acesso → erro de configuração: abortar o run
        // inteiro (não adianta consultar os demais e ainda estoura rate limit).
        if (res.motivo === 'auth') {
          return NextResponse.json(
            { error: 'DataJud: falha de autenticação (verifique DATAJUD_API_KEY)', atualizados, novas_movimentacoes: novasTotais },
            { status: 502 },
          )
        }
        // rate_limit → encerrar e reportar o que já foi feito; o próximo run continua.
        if (res.motivo === 'rate_limit') {
          erros.push('rate_limit atingido — interrompido')
          break
        }
        if (res.motivo !== 'nao_encontrado') {
          erros.push(`${processo.numero_processo}: ${res.motivo}`)
        } else {
          // Processo não indexado no DataJud ainda — marca como verificado hoje
          // para não ficar no topo da fila a cada rodada.
          await db
            .from('processos_juridicos')
            .update({ ultimo_datajud_update: new Date().toISOString() })
            .eq('id', processo.id)
        }
        continue
      }

      // Encontrado mas sem movimentos: marca como verificado assim mesmo
      if (!res.processo.movimentos.length) {
        await db
          .from('processos_juridicos')
          .update({ ultimo_datajud_update: new Date().toISOString() })
          .eq('id', processo.id)
        atualizados++
        continue
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
        erros.push(`${processo.numero_processo}: ${errMovs.message}`)
        continue
      }

      const qtdNovas = inserted?.length ?? 0
      novasTotais += qtdNovas

      // Registra processo com novas movimentações para e-mail ao responsável
      if (qtdNovas > 0 && processo.advogado_id) {
        notificacoes.push({
          advogadoId: processo.advogado_id as string,
          processoId: processo.id,
          numero:     processo.numero_processo,
          assunto:    (processo.assunto as string | null) ?? null,
          qtdNovas,
        })
      }

      // Atualiza timestamp de última consulta DataJud
      await db
        .from('processos_juridicos')
        .update({ ultimo_datajud_update: new Date().toISOString() })
        .eq('id', processo.id)

      atualizados++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`${processo.numero_processo}: ${msg}`)
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
