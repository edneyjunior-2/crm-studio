export const maxDuration = 60 // SINAPI tem milhares de linhas

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSinapiMatrix, type TipoPreco, type PrecoReferenciaRow } from '@/lib/sinapi'

/**
 * POST /api/obras/sinapi/importar  (platform admin)
 * FormData: arquivo (.xlsx), uf, data_ref (YYYY-MM), tipo (insumo|composicao), fonte?
 * Importa o catálogo SINAPI para precos_referencia (upsert por código).
 */
export async function POST(req: NextRequest) {
  try {
    await getAuthPlatformAdmin() // 401/redirect se não for admin da plataforma
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('arquivo') as File | null
  const uf = (form.get('uf') as string)?.trim().toUpperCase()
  const dataRefMes = (form.get('data_ref') as string)?.trim() // YYYY-MM
  const tipo = (form.get('tipo') as string)?.trim() as TipoPreco
  const fonte = ((form.get('fonte') as string)?.trim() || 'SINAPI').toUpperCase()

  if (!file || file.size === 0) return NextResponse.json({ error: 'Envie a planilha (.xlsx).' }, { status: 400 })
  if (!uf || uf.length !== 2) return NextResponse.json({ error: 'UF inválida (ex.: BA).' }, { status: 400 })
  if (!/^\d{4}-\d{2}$/.test(dataRefMes || '')) return NextResponse.json({ error: 'Data de referência inválida (use AAAA-MM).' }, { status: 400 })
  if (tipo !== 'insumo' && tipo !== 'composicao') return NextResponse.json({ error: 'Tipo deve ser insumo ou composicao.' }, { status: 400 })

  const data_ref = `${dataRefMes}-01`

  // Lê a planilha → matriz (array de arrays) da primeira aba
  let matrix: unknown[][]
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false }) as unknown[][]
  } catch (e) {
    return NextResponse.json({ error: `Falha ao ler a planilha: ${e instanceof Error ? e.message : 'erro'}` }, { status: 400 })
  }

  const { itens, headerRow, aviso } = parseSinapiMatrix(matrix, { fonte, uf, data_ref, tipo })
  if (headerRow === -1 || itens.length === 0) {
    return NextResponse.json(
      { error: aviso ?? 'Nenhum item reconhecido na planilha. Verifique as colunas (Código, Descrição, Custo).' },
      { status: 422 },
    )
  }

  // Upsert em lote (admin client bypassa RLS; conflito por chave única)
  const db = createAdminClient()
  const CHUNK = 500
  let gravados = 0
  for (let i = 0; i < itens.length; i += CHUNK) {
    const lote = itens.slice(i, i + CHUNK) as PrecoReferenciaRow[]
    const { error } = await db
      .from('precos_referencia')
      .upsert(lote, { onConflict: 'fonte,uf,data_ref,tipo,codigo' })
    if (error) {
      return NextResponse.json({ error: `Erro ao gravar (lote ${i}): ${error.message}`, gravados }, { status: 500 })
    }
    gravados += lote.length
  }

  return NextResponse.json({ ok: true, gravados, tipo, uf, data_ref, fonte })
}
