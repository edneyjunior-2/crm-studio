import { notFound } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { OrcamentoEditor } from './orcamento-editor'

export const dynamic = 'force-dynamic'

export default async function OrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await getAuthUser()

  const [{ data: orcamento }, { data: itens }, { data: clientes }] = await Promise.all([
    supabase.from('orcamentos').select('*').eq('id', id).single(),
    supabase.from('orcamento_itens').select('*').eq('orcamento_id', id).order('etapa').order('ordem').order('created_at'),
    supabase.from('clientes').select('id, razao_social').order('razao_social'),
  ])

  if (!orcamento) notFound()

  return <OrcamentoEditor orcamento={orcamento} itens={itens ?? []} clientes={clientes ?? []} />
}
