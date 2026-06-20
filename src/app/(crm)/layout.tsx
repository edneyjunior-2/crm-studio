import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { acessoLiberado } from '@/lib/gating'
import { modulosEfetivos } from '@/lib/modulos'
import { CRMShell } from '@/components/crm/crm-shell'
import { BannerAssinatura } from '@/components/crm/banner-assinatura'
import { Toaster } from '@/components/ui/sonner'
import { TourBoasVindas } from '@/components/crm/tour-boas-vindas'
import type { Profile } from '@/types'

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, empresaId, plano, status, trialEndsAt, supabase } = await getAuthUser()

  // Conta sem empresa → fluxo de vinculação por código
  if (!empresaId) redirect('/entrar/empresa')

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
      .select('modulos_ativos, modulos_ocultos, nome')
      .eq('id', empresaId)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', user.id)
      .single(),
  ])

  if (!profile) redirect('/login')

  const modulosAtivosExtras: string[] = empresaData?.modulos_ativos ?? []
  const modulosOcultos: string[] = empresaData?.modulos_ocultos ?? []

  // Conjunto efetivo de módulos para esta empresa, subtraindo os que o admin optou por ocultar
  const modulosAtivos = Array.from(modulosEfetivos(plano, modulosAtivosExtras))
    .filter((m) => !modulosOcultos.includes(m))

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Banner de aviso de assinatura (trial / pendente / atrasado) */}
      <BannerAssinatura status={status} diasRestantes={diasRestantes} />

      <CRMShell
        profile={profile as Profile}
        modulosAtivos={modulosAtivos}
        empresaId={empresaId}
        empresaNome={empresaData?.nome ?? null}
      >{children}</CRMShell>

      <Toaster richColors position="top-right" />
      <TourBoasVindas />
    </div>
  )
}

// TODO (2ª onda): adicionar checagem de temModulo nas Server Actions de cada módulo.
// TODO (2ª onda): adicionar RLS por módulo no banco (coluna modulo em tabelas gateadas).
