import { NextResponse } from 'next/server'
import { getAuthFinanceiro } from '@/lib/auth'
import { toCsv, exportFilename } from '@/lib/csv'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export async function GET() {
  const { supabase } = await getAuthFinanceiro()

  type RowReceber = {
    descricao: string | null
    valor: number | null
    data_vencimento: string | null
    data_recebimento: string | null
    status: string | null
    created_at: string
  }
  type RowPagar = {
    descricao: string | null
    fornecedor: string | null
    valor: number | null
    data_vencimento: string | null
    data_pagamento: string | null
    categoria: string | null
    status: string | null
    created_at: string
  }

  let receberData: RowReceber[]
  let pagarData: RowPagar[]

  try {
    ;[receberData, pagarData] = await Promise.all([
      fetchAllRows<RowReceber>((from, to) =>
        supabase
          .from('contas_receber')
          .select('descricao, valor, data_vencimento, data_recebimento, status, created_at')
          .order('data_vencimento', { ascending: false })
          .range(from, to),
      ),
      fetchAllRows<RowPagar>((from, to) =>
        supabase
          .from('contas_pagar')
          .select('descricao, fornecedor, valor, data_vencimento, data_pagamento, categoria, status, created_at')
          .order('data_vencimento', { ascending: false })
          .range(from, to),
      ),
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const headersReceber: Record<string, string> = {
    descricao: 'Descrição',
    valor: 'Valor',
    data_vencimento: 'Vencimento',
    data_recebimento: 'Recebimento',
    status: 'Status',
    created_at: 'Criado em',
  }

  const headersPagar: Record<string, string> = {
    descricao: 'Descrição',
    fornecedor: 'Fornecedor',
    valor: 'Valor',
    data_vencimento: 'Vencimento',
    data_pagamento: 'Pagamento',
    categoria: 'Categoria',
    status: 'Status',
    created_at: 'Criado em',
  }

  const rowsReceber = receberData.map((r) => ({
    ...r,
    created_at: r.created_at ? r.created_at.slice(0, 10) : '',
  }))

  const rowsPagar = pagarData.map((r) => ({
    ...r,
    created_at: r.created_at ? r.created_at.slice(0, 10) : '',
  }))

  const csvReceber = toCsv(headersReceber, rowsReceber)
  const csvPagar = toCsv(headersPagar, rowsPagar)

  // Combina os dois CSVs com separador de seção
  // Remove o BOM do segundo bloco para não duplicar
  const BOM = '﻿'
  const combined =
    `${BOM}# CONTAS A RECEBER\n` +
    csvReceber.replace(BOM, '') +
    '\n\n# CONTAS A PAGAR\n' +
    csvPagar.replace(BOM, '')

  const filename = exportFilename('financeiro', 'csv')

  return new NextResponse(combined, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
