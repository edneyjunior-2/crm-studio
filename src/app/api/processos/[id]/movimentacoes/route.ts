import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: processoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { empresaId } = await getAuthUser()
  if (!empresaId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })

  // Garante que o processo pertence à empresa (ativa) do usuário
  const { data: processo } = await supabase
    .from('processos_juridicos')
    .select('id')
    .eq('id', processoId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!processo) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

  const body = await req.json() as { descricao?: string; complemento?: string; data_movimentacao?: string }
  const { descricao, complemento, data_movimentacao } = body

  if (!descricao?.trim()) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })
  if (!data_movimentacao) return NextResponse.json({ error: 'Data obrigatória' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('movimentacoes_processo')
    .insert({
      processo_id: processoId,
      empresa_id: empresaId,
      codigo_movimento: null, // null = movimentação manual (sem código DataJud)
      descricao: descricao.trim(),
      complemento: complemento?.trim() || null,
      data_movimentacao,
      lido: true,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
