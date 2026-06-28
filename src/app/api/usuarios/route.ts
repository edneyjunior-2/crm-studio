import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { empresaId } = await getAuthUser()
  if (!empresaId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('empresa_id', empresaId)
    .order('full_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
