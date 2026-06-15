import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { exportFilename } from '@/lib/csv'

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
  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('razao_social, cnpj, contato_nome, contato_email, contato_telefone, segmento, observacoes, created_at')
    .order('razao_social', { ascending: true })

  if (clientesError) {
    return NextResponse.json({ error: clientesError.message }, { status: 500 })
  }

  // Negócios
  const { data: negocios, error: negociosError } = await supabase
    .from('negocios')
    .select('titulo, estagio, valor_estimado, probabilidade, data_previsao_fechamento, observacoes, created_at, clientes(razao_social), solucoes(nome)')
    .order('created_at', { ascending: false })

  if (negociosError) {
    return NextResponse.json({ error: negociosError.message }, { status: 500 })
  }

  // Financeiro — apenas admin/socio
  let financeiro: { receber: unknown[]; pagar: unknown[] } | null = null

  if (podeVerFinanceiro) {
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

    financeiro = {
      receber: receberResult.data ?? [],
      pagar: pagarResult.data ?? [],
    }
  }

  const payload = {
    empresa: empresaData ?? null,
    clientes: clientes ?? [],
    negocios: negocios ?? [],
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
