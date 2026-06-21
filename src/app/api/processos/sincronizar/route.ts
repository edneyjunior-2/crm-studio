export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarProcessoDataJud } from '@/lib/datajud'

const THROTTLE_MS = 300
const LOTE        = 5    // DataJud tem timeout de 8s/req → 5 × (8 + 0.3) = 41s worst case, seguro em 60s
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Só admin e sócio podem disparar sincronização manual
  const { data: perfil } = await supabase
    .from('profiles')
    .select('role, empresa_id')
    .eq('id', user.id)
    .single()

  if (!perfil?.empresa_id) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })
  }
  if (!['admin', 'socio'].includes(perfil.role ?? '')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body    = await req.json() as { offset?: number; total?: number }
  const offset  = body.offset ?? 0
  const admin   = createAdminClient()

  // Processos mais desatualizados primeiro (NULLS FIRST = nunca sincronizados)
  const { data: processos, error } = await admin
    .from('processos_juridicos')
    .select('id, numero_processo, tribunal_slug, empresa_id')
    .eq('empresa_id', perfil.empresa_id)
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
      .eq('empresa_id', perfil.empresa_id)
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
