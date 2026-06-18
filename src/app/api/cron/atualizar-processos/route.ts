import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarProcessoDataJud } from '@/lib/datajud'

export const maxDuration = 300 // 5 min (Vercel Pro)

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

  // Busca todos os processos ativos de todas as empresas
  const { data: processos, error } = await db
    .from('processos_juridicos')
    .select('id, numero_processo, tribunal_slug, empresa_id')
    .eq('status', 'ativo')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!processos || processos.length === 0) {
    return NextResponse.json({ atualizados: 0, novas_movimentacoes: 0 })
  }

  let atualizados    = 0
  let novasTotais    = 0
  const erros: string[] = []

  for (const processo of processos) {
    try {
      const dados = await buscarProcessoDataJud(
        processo.numero_processo,
        processo.tribunal_slug,
      )

      if (!dados || !dados.movimentos.length) continue

      // Mapear movimentações para inserção
      const movs = dados.movimentos.map((m) => {
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
      const { data: inserted } = await db
        .from('movimentacoes_processo')
        .upsert(movs, {
          onConflict:       'processo_id,codigo_movimento,data_movimentacao',
          ignoreDuplicates: true,
        })
        .select('id')

      const qtdNovas = inserted?.length ?? 0
      novasTotais += qtdNovas

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

  return NextResponse.json({
    atualizados,
    novas_movimentacoes: novasTotais,
    ...(erros.length ? { erros } : {}),
  })
}
