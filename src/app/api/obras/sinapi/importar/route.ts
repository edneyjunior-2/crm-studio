export const maxDuration = 60 // SINAPI tem ~15 mil linhas (insumos + composições)

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSinapiReferencia } from '@/lib/sinapi'

/**
 * POST /api/obras/sinapi/importar  (platform admin)
 * FormData: arquivo (SINAPI_Referência_AAAA_MM.xlsx), uf, data_ref (AAAA-MM), fonte?
 * Importa insumos + composições (com e sem desoneração) da UF escolhida.
 */
export async function POST(req: NextRequest) {
  try {
    await getAuthPlatformAdmin()
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('arquivo') as File | null
  const uf = (form.get('uf') as string)?.trim().toUpperCase()
  const dataRefMes = (form.get('data_ref') as string)?.trim()
  const fonte = ((form.get('fonte') as string)?.trim() || 'SINAPI').toUpperCase()

  if (!file || file.size === 0) return NextResponse.json({ error: 'Envie o arquivo SINAPI_Referência (.xlsx).' }, { status: 400 })
  if (!uf || uf.length !== 2) return NextResponse.json({ error: 'UF inválida (ex.: BA).' }, { status: 400 })
  if (!/^\d{4}-\d{2}$/.test(dataRefMes || '')) return NextResponse.json({ error: 'Mês de referência inválido (use AAAA-MM).' }, { status: 400 })

  const data_ref = `${dataRefMes}-01`

  let wb: XLSX.WorkBook
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true, cellText: true })
  } catch (e) {
    return NextResponse.json({ error: `Falha ao ler a planilha: ${e instanceof Error ? e.message : 'erro'}` }, { status: 400 })
  }

  const { itens, resumo, aviso } = parseSinapiReferencia(wb, { fonte, uf, data_ref })
  if (itens.length === 0) {
    return NextResponse.json({ error: aviso ?? 'Nenhum item reconhecido na planilha.' }, { status: 422 })
  }

  const db = createAdminClient()
  const CHUNK = 500
  let gravados = 0
  for (let i = 0; i < itens.length; i += CHUNK) {
    const lote = itens.slice(i, i + CHUNK)
    const { error } = await db
      .from('precos_referencia')
      .upsert(lote, { onConflict: 'fonte,uf,data_ref,tipo,codigo' })
    if (error) {
      return NextResponse.json({ error: `Erro ao gravar (lote ${i}): ${error.message}`, gravados }, { status: 500 })
    }
    gravados += lote.length
  }

  return NextResponse.json({
    ok: true,
    gravados,
    insumos: resumo.insumo ?? 0,
    composicoes: resumo.composicao ?? 0,
    uf,
    data_ref,
    fonte,
  })
}
