import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { acessoLiberado } from '@/lib/gating'
import { modulosEfetivos } from '@/lib/modulos'
import { createAdminClient } from '@/lib/supabase/admin'
import { CRMShell } from '@/components/crm/crm-shell'
import { BannerAssinatura } from '@/components/crm/banner-assinatura'
import { Toaster } from '@/components/ui/sonner'
import { TourBoasVindas } from '@/components/crm/tour-boas-vindas'
import { SyncDataJudProvider } from '@/components/crm/sync-datajud-provider'
import type { Profile } from '@/types'

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, empresaId, isPlatformAdmin, plano, status, trialEndsAt, supabase, role, modulosPermitidos } = await getAuthUser()

  // Conta sem empresa → fluxo de vinculação
  // Platform admin sem empresa ativa → seletor de tenant (evita loop: /selecionar-empresa está fora deste grupo)
  // Usuário comum sem empresa → tela de código de acesso
  if (!empresaId) {
    if (isPlatformAdmin) redirect('/selecionar-empresa')
    else redirect('/entrar/empresa')
  }

  // Cadastro com cartão pendente de confirmação → volta pro checkout (não é o
  // paywall genérico de /assinatura, que espera trial/suspenso/cancelado).
  if (status === 'pendente_cartao') redirect('/cadastro/pagamento')

  // Assinatura suspensa/cancelada → paywall (sem loop: /assinatura fica fora deste grupo)
  if (!acessoLiberado(status)) redirect('/assinatura')

  // Calcula dias restantes de trial (usando getFullYear/getMonth/getDate para evitar toISOString)
  let diasRestantes: number | null = null
  if (trialEndsAt && status === 'trial') {
    const end = new Date(trialEndsAt)
    const now = new Date()
    const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    diasRestantes = Math.ceil((endMidnight.getTime() - todayMidnight.getTime()) / 86_400_000)
  }

  // Paralelize as duas queries independentes
  const [{ data: empresaData }, { data: profile }] = await Promise.all([
    supabase
      .from('empresas')
      .select('modulos_ativos, modulos_ocultos, nome, primeiro_acesso_em')
      .eq('id', empresaId)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', user.id)
      .single(),
  ])

  if (!profile) redirect('/login')

  // Registra o primeiro acesso do cliente ao CRM (fire-and-forget, idempotente)
  if (!empresaData?.primeiro_acesso_em && empresaId) {
    const adminDb = createAdminClient()
    adminDb
      .from('empresas')
      .update({ primeiro_acesso_em: new Date().toISOString() })
      .eq('id', empresaId)
      .is('primeiro_acesso_em', null)
      .then(() => {})
  }

  const modulosAtivosExtras: string[] = empresaData?.modulos_ativos ?? []
  const modulosOcultos: string[] = empresaData?.modulos_ocultos ?? []

  // Conjunto efetivo de módulos para esta empresa, subtraindo os que o admin optou por ocultar
  const modulosEmpresa = modulosEfetivos(plano, modulosAtivosExtras)
  // RBAC por usuário (inline): admin/null = sem restrição
  const modulosUsuario = (role === 'admin' || modulosPermitidos == null)
    ? modulosEmpresa
    : new Set([...modulosEmpresa].filter((m) => modulosPermitidos.includes(m)))
  const modulosAtivos = Array.from(modulosUsuario)
    .filter((m) => !modulosOcultos.includes(m))

  return (
    <SyncDataJudProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        {/* Banner de aviso de assinatura (trial / pendente / atrasado) */}
        <BannerAssinatura status={status} diasRestantes={diasRestantes} />

        <CRMShell
          profile={profile as Profile}
          modulosAtivos={modulosAtivos}
          empresaId={empresaId}
          empresaNome={empresaData?.nome ?? null}
          isPlatformAdmin={isPlatformAdmin}
        >{children}</CRMShell>

        <Toaster richColors position="top-right" />
        <TourBoasVindas />
      </div>
    </SyncDataJudProvider>
  )
}

// TODO (2ª onda): adicionar checagem de temModulo nas Server Actions de cada módulo.
// TODO (2ª onda): adicionar RLS por módulo no banco (coluna modulo em tabelas gateadas).
