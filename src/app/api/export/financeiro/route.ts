import { NextResponse } from 'next/server'
import { getAuthFinanceiro } from '@/lib/auth'
import { toCsv, exportFilename } from '@/lib/csv'

export async function GET() {
  const { supabase } = await getAuthFinanceiro()

  const [receberResult, pagarResult] = await Promise.all([
    supabase
      .from('contas_receber')
      .select('descricao, valor, data_vencimento, data_recebimento, status, created_at')
      .order('data_vencimento', { ascending: false }),
    supabase
      .from('contas_pagar')
      .select('descricao, fornecedor, valor, data_vencimento, data_pagamento, categoria, status, created_at')
      .order('data_vencimento', { ascending: false }),
  ])

  if (receberResult.error) {
    return NextResponse.json({ error: receberResult.error.message }, { status: 500 })
  }
  if (pagarResult.error) {
    return NextResponse.json({ error: pagarResult.error.message }, { status: 500 })
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

  const rowsReceber = (receberResult.data ?? []).map((r) => ({
    ...r,
    created_at: r.created_at ? r.created_at.slice(0, 10) : '',
  }))

  const rowsPagar = (pagarResult.data ?? []).map((r) => ({
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
