import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { toCsv, exportFilename } from '@/lib/csv'

export async function GET() {
  const { supabase } = await getAuthUser()

  const { data, error } = await supabase
    .from('negocios')
    .select('titulo, estagio, valor_estimado, probabilidade, data_previsao_fechamento, observacoes, created_at, clientes(razao_social), solucoes(nome), profiles!responsavel_id(full_name)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const headers: Record<string, string> = {
    titulo: 'Título',
    cliente: 'Cliente',
    solucao: 'Solução',
    responsavel: 'Responsável',
    estagio: 'Estágio',
    valor_estimado: 'Valor Estimado',
    probabilidade: 'Probabilidade (%)',
    data_previsao_fechamento: 'Previsão de Fechamento',
    observacoes: 'Observações',
    created_at: 'Criado em',
  }

  const rows = (data ?? []).map((r) => {
    // Supabase returns relations as arrays; pick first element safely
    const clienteRel = r.clientes
    const solucaoRel = r.solucoes
    const profileRel = r.profiles

    const clienteNome = Array.isArray(clienteRel)
      ? (clienteRel[0] as { razao_social: string } | undefined)?.razao_social ?? ''
      : (clienteRel as { razao_social: string } | null)?.razao_social ?? ''

    const solucaoNome = Array.isArray(solucaoRel)
      ? (solucaoRel[0] as { nome: string } | undefined)?.nome ?? ''
      : (solucaoRel as { nome: string } | null)?.nome ?? ''

    const responsavelNome = Array.isArray(profileRel)
      ? (profileRel[0] as { full_name: string } | undefined)?.full_name ?? ''
      : (profileRel as { full_name: string } | null)?.full_name ?? ''

    return {
      titulo: r.titulo,
      cliente: clienteNome,
      solucao: solucaoNome,
      responsavel: responsavelNome,
      estagio: r.estagio,
      valor_estimado: r.valor_estimado ?? '',
      probabilidade: r.probabilidade ?? '',
      data_previsao_fechamento: r.data_previsao_fechamento ?? '',
      observacoes: r.observacoes ?? '',
      created_at: r.created_at ? r.created_at.slice(0, 10) : '',
    }
  })

  const csv = toCsv(headers, rows)
  const filename = exportFilename('pipeline', 'csv')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
