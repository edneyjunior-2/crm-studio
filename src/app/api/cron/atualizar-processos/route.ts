import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarProcessoDataJud } from '@/lib/datajud'
import { sendNovasMovimentacoesEmail } from '@/lib/email'

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
  // Proteção por secret
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // Processa os 30 mais desatualizados por rodada (NULLS FIRST = nunca sincronizados antes).
  // Com cron a cada 30 min: 262 processos ÷ 30 por rodada = 9 rodadas → todos atualizados em ~4.5h.
  const LOTE_CRON = 30
  const { data: processos, error } = await db
    .from('processos_juridicos')
    .select('id, numero_processo, tribunal_slug, empresa_id, advogado_id, assunto')
    .eq('status', 'ativo')
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
      const movs = res.processo.movimentos.map((m) => {
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
      // Busca e-mail e nome de cada advogado único
      const uniqueIds = [...new Set(notificacoes.map((n) => n.advogadoId))]
      const advMap: Record<string, { email: string; nome: string }> = {}

      await Promise.all(
        uniqueIds.map(async (id) => {
          const [{ data: authUser }, { data: perfil }] = await Promise.all([
            db.auth.admin.getUserById(id),
            db.from('profiles').select('full_name').eq('id', id).single(),
          ])
          const email = authUser?.user?.email
          if (email) {
            advMap[id] = {
              email,
              nome: (perfil?.full_name as string | null) ?? email.split('@')[0],
            }
          }
        })
      )

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
