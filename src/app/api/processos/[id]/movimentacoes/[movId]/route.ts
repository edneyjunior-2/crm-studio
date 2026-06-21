import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; movId: string }> },
) {
  const { id: processoId, movId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()
  if (!perfil?.empresa_id) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })

  const admin = createAdminClient()

  // Só exclui se for manual (codigo_movimento IS NULL) e pertencer à empresa — DataJud não se apaga
  const { data: mov } = await admin
    .from('movimentacoes_processo')
    .select('id')
    .eq('id', movId)
    .eq('processo_id', processoId)
    .eq('empresa_id', perfil.empresa_id)
    .is('codigo_movimento', null)
    .maybeSingle()

  if (!mov) return NextResponse.json({ error: 'Movimentação não encontrada ou não pode ser excluída' }, { status: 404 })

  const { error } = await admin
    .from('movimentacoes_processo')
    .delete()
    .eq('id', movId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
