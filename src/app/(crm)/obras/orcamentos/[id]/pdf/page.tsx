import { notFound } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { OrcamentoPdfView } from './pdf-view'

export const dynamic = 'force-dynamic'

export default async function OrcamentoPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, empresaId, user } = await getAuthUser()

  const [{ data: orcamento }, itens, { data: empresa }, { data: perfil }] = await Promise.all([
    supabase.from('orcamentos').select('*, cliente:clientes(razao_social, cnpj), obra:obras(nome, endereco)').eq('id', id).single(),
    // fetchAllRows contorna o cap de 1000 linhas do PostgREST
    fetchAllRows((from, to) =>
      supabase
        .from('orcamento_itens')
        .select('*')
        .eq('orcamento_id', id)
        .order('etapa')
        .order('created_at')
        .range(from, to),
    ),
    empresaId
      ? supabase.from('empresas').select('nome, razao_social, nome_fantasia, cnpj').eq('id', empresaId).single()
      : Promise.resolve({ data: null }),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (!orcamento) notFound()

  return (
    <OrcamentoPdfView
      orcamento={orcamento}
      itens={itens}
      empresa={empresa ?? null}
      usuarioNome={perfil?.full_name ?? null}
    />
  )
}
