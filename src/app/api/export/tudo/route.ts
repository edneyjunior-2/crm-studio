import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { exportFilename } from '@/lib/csv'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export async function GET() {
  const { supabase, role, empresaId } = await getAuthUser()

  const podeVerFinanceiro = role === 'admin' || role === 'socio'

  // Dados da empresa
  const { data: empresaData, error: empresaError } = await supabase
    .from('empresas')
    .select('id, nome, slug, plano, status, cnpj, razao_social, nome_fantasia, cpf, tipo_pessoa, encarregado_nome, encarregado_email, encarregado_telefone, aceite_termos_versao, aceite_termos_em, created_at')
    .eq('id', empresaId ?? '')
    .single()

  if (empresaError && empresaId) {
    return NextResponse.json({ error: empresaError.message }, { status: 500 })
  }

  // Clientes
  let clientes: unknown[]
  try {
    clientes = await fetchAllRows((from, to) =>
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

  // Negócios
  let negocios: unknown[]
  try {
    negocios = await fetchAllRows((from, to) =>
      supabase
        .from('negocios')
        .select('titulo, estagio, valor_estimado, probabilidade, data_previsao_fechamento, observacoes, created_at, clientes(razao_social), solucoes(nome)')
        .order('created_at', { ascending: false })
        .range(from, to),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Financeiro — apenas admin/socio
  let financeiro: { receber: unknown[]; pagar: unknown[] } | null = null

  if (podeVerFinanceiro) {
    try {
      const [receberData, pagarData] = await Promise.all([
        fetchAllRows((from, to) =>
          supabase
            .from('contas_receber')
            .select('descricao, valor, data_vencimento, data_recebimento, status, created_at')
            .order('data_vencimento', { ascending: false })
            .range(from, to),
        ),
        fetchAllRows((from, to) =>
          supabase
            .from('contas_pagar')
            .select('descricao, fornecedor, valor, data_vencimento, data_pagamento, categoria, status, created_at')
            .order('data_vencimento', { ascending: false })
            .range(from, to),
        ),
      ])
      financeiro = {
        receber: receberData,
        pagar: pagarData,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  const payload = {
    empresa: empresaData ?? null,
    clientes,
    negocios,
    financeiro,
    exportado_em: new Date().toISOString(),
  }

  const filename = exportFilename('crm-studio-export', 'json')

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
