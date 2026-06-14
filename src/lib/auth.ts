import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type Role = 'admin' | 'socio' | 'comercial'
type PlanoEmpresa = 'free' | 'starter' | 'pro' | 'business'
type StatusEmpresa = 'trial' | 'ativo' | 'pendente' | 'atrasado' | 'suspenso' | 'cancelado'

export interface AuthResult {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  role: Role
  /** Tenant ao qual o usuário pertence. Null só em conta órfã (criação manual fora do fluxo). */
  empresaId: string | null
  plano: PlanoEmpresa
  status: StatusEmpresa
}

/** Verifica auth e retorna supabase + user + role + contexto do tenant. Redireciona para /login se não autenticado. */
export async function getAuthUser(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, empresa_id, empresas(plano, status)')
    .eq('id', user.id)
    .single()

  const empresa = (profile?.empresas ?? null) as { plano?: string; status?: string } | null

  return {
    supabase,
    user,
    role: (profile?.role ?? 'comercial') as Role,
    empresaId: (profile?.empresa_id ?? null) as string | null,
    plano: (empresa?.plano ?? 'free') as PlanoEmpresa,
    status: (empresa?.status ?? 'trial') as StatusEmpresa,
  }
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
