import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type Role = 'admin' | 'socio' | 'comercial'

export interface AuthResult {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  role: Role
}

/** Verifica auth e retorna supabase + user + role. Redireciona para /login se não autenticado. */
export async function getAuthUser(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { supabase, user, role: (profile?.role ?? 'comercial') as Role }
}

/** Apenas admin e sócio. Redireciona para /dashboard caso contrário. */
export async function getAuthFinanceiro(): Promise<AuthResult> {
  const auth = await getAuthUser()
  if (!['admin', 'socio'].includes(auth.role)) redirect('/dashboard')
  return auth
}

/** Apenas admin. Redireciona para /dashboard caso contrário. */
export async function getAuthAdmin(): Promise<AuthResult> {
  const auth = await getAuthUser()
  if (auth.role !== 'admin') redirect('/dashboard')
  return auth
}
