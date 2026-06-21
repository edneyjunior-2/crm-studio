import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (!perfil?.empresa_id) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('movimentacoes_processo')
    .update({ lido: true })
    .eq('empresa_id', perfil.empresa_id)
    .eq('lido', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
