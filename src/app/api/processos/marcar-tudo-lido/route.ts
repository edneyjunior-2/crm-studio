import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { empresaId, role } = await getAuthUser()
  if (!empresaId) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })
  }
  // Escreve via admin client abaixo (bypassa RLS) — o gate de papel tem que
  // ser explícito aqui. Parceiro (externo, read-only) nunca marca como lido.
  if (role === 'parceiro') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('movimentacoes_processo')
    .update({ lido: true })
    .eq('empresa_id', empresaId)
    .eq('lido', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
