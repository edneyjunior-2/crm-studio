import { notFound } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { listarClientesDaSolucao } from '@/lib/solucao-clientes'
import { SolucaoPdfView } from './pdf-view'

export const dynamic = 'force-dynamic'

export default async function SolucaoPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, empresaId, user } = await getAuthUser()

  const [{ data: solucao }, clientes, { data: empresa }, { data: perfil }] = await Promise.all([
    supabase.from('solucoes').select('nome, empresa_representada, comissao_percentual').eq('id', id).single(),
    listarClientesDaSolucao(id),
    empresaId
      ? supabase.from('empresas').select('nome, razao_social, nome_fantasia, cnpj').eq('id', empresaId).single()
      : Promise.resolve({ data: null }),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (!solucao) notFound()

  return (
    <SolucaoPdfView
      solucao={solucao}
      clientes={clientes}
      empresa={empresa ?? null}
      usuarioNome={perfil?.full_name ?? null}
    />
  )
}
