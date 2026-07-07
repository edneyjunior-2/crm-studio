export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarProcessoDataJud } from '@/lib/datajud'
import { getAuthUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const THROTTLE_MS = 300
// DataJud tem timeout de 15s/req (ver DATAJUD_TIMEOUT_MS) → 3 × (15 + 0.3) = 46s
// worst case, seguro sob o maxDuration de 60s. Reduzido de 5→3 em 2026-07-07
// junto com a subida do timeout 8s→15s (senão 5 × 15.3 = 76s estouraria os 60s).
const LOTE        = 3
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Só admin e sócio podem disparar; empresaId efetivo (tenant ativo p/ platform admin)
  const { empresaId, role } = await getAuthUser()
  if (!empresaId) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })
  }
  if (!['admin', 'socio'].includes(role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body    = await req.json() as { offset?: number; total?: number }
  const offset  = body.offset ?? 0

  // Cooldown: só permite INICIAR uma sincronização manual por empresa a cada 10
  // min (offset 0 = início; os lotes seguintes da mesma sync não rechecam). Evita
  // re-consultar o DataJud à toa logo após uma sync completa — os processos também
  // atualizam sozinhos via cron no horário comercial. Reusa rate_limits/check_rate_limit.
  if (offset === 0 && !(await rateLimit(`sync-manual:${empresaId}`, 1, 600))) {
    return NextResponse.json(
      { error: 'Você sincronizou há pouco. Aguarde alguns minutos para sincronizar de novo — os processos também atualizam automaticamente no horário comercial.' },
      { status: 429 },
    )
  }

  const admin   = createAdminClient()

  // Processos mais desatualizados primeiro (NULLS FIRST = nunca sincronizados)
  const { data: processos, error } = await admin
    .from('processos_juridicos')
    .select('id, numero_processo, tribunal_slug, empresa_id')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .order('ultimo_datajud_update', { ascending: true, nullsFirst: true })
    .range(offset, offset + LOTE - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Total de ativos para calcular progresso no cliente
  let total = body.total
  if (total === undefined) {
    const { count } = await admin
      .from('processos_juridicos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'ativo')
    total = count ?? 0
  }

  if (!processos || processos.length === 0) {
    return NextResponse.json({ sincronizados: 0, novas_movimentacoes: 0, erros: [], tem_mais: false, total })
  }

  let sincronizados = 0
  let novas         = 0
  const erros: string[] = []

  for (let i = 0; i < processos.length; i++) {
    if (i > 0) await sleep(THROTTLE_MS)
    const processo = processos[i]

    try {
      const res = await buscarProcessoDataJud(processo.numero_processo, processo.tribunal_slug)

      if (!res.ok) {
        if (res.motivo === 'auth') {
          return NextResponse.json(
            { error: 'DataJud: falha de autenticação (verifique DATAJUD_API_KEY)', sincronizados, novas_movimentacoes: novas, erros, tem_mais: true, total },
            { status: 502 },
          )
        }
        if (res.motivo === 'rate_limit') { erros.push('rate_limit'); break }
        if (res.motivo !== 'nao_encontrado') {
          erros.push(`${processo.numero_processo}: ${res.motivo}`)
        } else {
          // Não indexado no DataJud ainda — marca como verificado para sair do topo da fila
          await admin.from('processos_juridicos').update({ ultimo_datajud_update: new Date().toISOString() }).eq('id', processo.id)
          sincronizados++
        }
        continue
      }

      if (!res.processo.movimentos.length) {
        await admin.from('processos_juridicos').update({ ultimo_datajud_update: new Date().toISOString() }).eq('id', processo.id)
        sincronizados++
        continue
      }

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

      const { data: inserted, error: errMovs } = await admin
        .from('movimentacoes_processo')
        .upsert(movs, { onConflict: 'processo_id,codigo_movimento,data_movimentacao', ignoreDuplicates: true })
        .select('id')

      if (errMovs) { erros.push(`${processo.numero_processo}: ${errMovs.message}`); continue }

      novas += inserted?.length ?? 0
      await admin.from('processos_juridicos').update({ ultimo_datajud_update: new Date().toISOString() }).eq('id', processo.id)
      sincronizados++
    } catch (err) {
      erros.push(`${processo.numero_processo}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const temMais = offset + processos.length < (total ?? 0)

  return NextResponse.json({
    sincronizados,
    novas_movimentacoes: novas,
    erros,
    tem_mais:     temMais,
    proximo:      offset + LOTE,
    total,
  })
}
