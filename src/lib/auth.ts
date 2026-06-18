import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type Role = 'admin' | 'socio' | 'comercial'
export type PlanoEmpresa = 'free' | 'trial' | 'interno' | 'starter' | 'pro' | 'business'
export type StatusEmpresa = 'trial' | 'ativo' | 'pendente' | 'atrasado' | 'suspenso' | 'cancelado'

export interface AuthResult {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  role: Role
  /** Tenant ao qual o usuário pertence. Null só em conta órfã (criação manual fora do fluxo). */
  empresaId: string | null
  plano: PlanoEmpresa
  status: StatusEmpresa
  /** ISO string de expiração do trial; null quando não aplicável. */
  trialEndsAt: string | null
}

/** Memoizado por request (React cache) — layout + página compartilham o mesmo resultado sem novo round-trip. */
export const getAuthUser = cache(async (): Promise<AuthResult> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, empresa_id, empresas(plano, status, trial_ends_at)')
    .eq('id', user.id)
    .single()

  const empresa = (profile?.empresas ?? null) as {
    plano?: string
    status?: string
    trial_ends_at?: string | null
  } | null

  return {
    supabase,
    user,
    role: (profile?.role ?? 'comercial') as Role,
    empresaId: (profile?.empresa_id ?? null) as string | null,
    plano: (empresa?.plano ?? 'free') as PlanoEmpresa,
    status: (empresa?.status ?? 'trial') as StatusEmpresa,
    trialEndsAt: empresa?.trial_ends_at ?? null,
  }
})

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

/** Apenas platform admins (tabela platform_admins). Redireciona para /dashboard. */
export const getAuthPlatformAdmin = cache(async (): Promise<AuthResult> => {
  const auth = await getAuthUser()
  const { data: isPlatformAdmin } = await auth.supabase.rpc('is_platform_admin')
  if (!isPlatformAdmin) redirect('/dashboard')
  return auth
})
