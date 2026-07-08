import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type Role = 'admin' | 'socio' | 'comercial' | 'parceiro'
export type PlanoEmpresa = 'free' | 'trial' | 'interno' | 'starter' | 'pro' | 'business'
export type StatusEmpresa = 'pendente_cartao' | 'trial' | 'ativo' | 'pendente' | 'atrasado' | 'suspenso' | 'cancelado'

export interface AuthResult {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  role: Role
  /** Tenant ao qual o usuário pertence. Null só em conta órfã (criação manual fora do fluxo).
   *  Para platform admin, reflete o tenant ativo (empresa_ativa_id), não o empresa_id fixo. */
  empresaId: string | null
  plano: PlanoEmpresa
  status: StatusEmpresa
  /** ISO string de expiração do trial; null quando não aplicável. */
  trialEndsAt: string | null
  /** Verdadeiro quando o usuário está na tabela platform_admins. */
  isPlatformAdmin: boolean
  /** Módulos que o usuário pode acessar. NULL = sem restrição (vê tudo). admin ignora. */
  modulosPermitidos: string[] | null
}

/** Memoizado por request (React cache) — layout + página compartilham o mesmo resultado sem novo round-trip. */
export const getAuthUser = cache(async (): Promise<AuthResult> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Busca profile e verifica se é platform admin em paralelo
  const [{ data: profile }, { data: isPlatformAdminRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, empresa_id, empresa_ativa_id, modulos_permitidos')
      .eq('id', user.id)
      .single(),
    supabase.rpc('is_platform_admin'),
  ])

  const isPlatformAdmin = isPlatformAdminRaw === true

  // Empresa efetiva: platform admin usa empresa_ativa_id; usuário comum usa empresa_id
  const empresaIdEfetivo: string | null = isPlatformAdmin
    ? ((profile?.empresa_ativa_id ?? null) as string | null)
    : ((profile?.empresa_id ?? null) as string | null)

  // Carrega dados do plano da empresa efetiva (quando há empresa ativa)
  let empresa: { plano?: string; status?: string; trial_ends_at?: string | null } | null = null
  if (empresaIdEfetivo) {
    const { data, error } = await supabase
      .from('empresas')
      .select('plano, status, trial_ends_at')
      .eq('id', empresaIdEfetivo)
      .maybeSingle()
    if (error) {
      console.error('[getAuthUser] erro ao buscar empresa:', error.message)
    }
    empresa = data
  }

  return {
    supabase,
    user,
    role: (profile?.role ?? 'comercial') as Role,
    empresaId: empresaIdEfetivo,
    plano: (empresa?.plano ?? 'free') as PlanoEmpresa,
    // Fail-closed: nunca presumir 'trial' quando a leitura da empresa falha ou
    // não retorna linha (erro transitório de conexão, lag logo após uma
    // migration etc.) — isso liberaria acesso total sem cartão confirmado pra
    // qualquer empresa em 'pendente_cartao' que sofresse esse blip.
    // 'pendente_cartao' já tem redirect próprio em (crm)/layout.tsx e nunca
    // passa em acessoLiberado() — é o fallback seguro (empresa legítima só
    // vê isso num blip raro e transitório, e resolve tentando de novo).
    status: (empresa?.status ?? 'pendente_cartao') as StatusEmpresa,
    trialEndsAt: empresa?.trial_ends_at ?? null,
    isPlatformAdmin,
    modulosPermitidos: (profile?.modulos_permitidos ?? null) as string[] | null,
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
  if (!auth.isPlatformAdmin) redirect('/dashboard')
  return auth
})
