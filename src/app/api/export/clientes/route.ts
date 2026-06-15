import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { toCsv, exportFilename } from '@/lib/csv'

export async function GET() {
  const { supabase } = await getAuthUser()

  const { data, error } = await supabase
    .from('clientes')
    .select('razao_social, cnpj, contato_nome, contato_email, contato_telefone, segmento, observacoes, created_at')
    .order('razao_social', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  const rows = (data ?? []).map((r) => ({
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
