import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { toCsv, exportFilename } from '@/lib/csv'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export async function GET() {
  const { supabase } = await getAuthUser()

  type ClienteRow = {
    razao_social: string
    cnpj: string | null
    contato_nome: string | null
    contato_email: string | null
    contato_telefone: string | null
    segmento: string | null
    observacoes: string | null
    created_at: string
  }

  let data: ClienteRow[]

  try {
    data = await fetchAllRows((from, to) =>
      supabase
        .from('clientes')
        .select('razao_social, cnpj, contato_nome, contato_email, contato_telefone, segmento, observacoes, created_at')
        .order('razao_social', { ascending: true })
        .range(from, to),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const headers: Record<string, string> = {
    razao_social: 'Razão Social',
    cnpj: 'CNPJ',
    contato_nome: 'Contato',
    contato_email: 'E-mail',
    contato_telefone: 'Telefone',
    segmento: 'Segmento',
    observacoes: 'Observações',
    created_at: 'Criado em',
  }

  const rows = data.map((r) => ({
    ...r,
    created_at: r.created_at ? r.created_at.slice(0, 10) : '',
  }))

  const csv = toCsv(headers, rows)
  const filename = exportFilename('clientes', 'csv')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
