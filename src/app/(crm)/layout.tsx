import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { acessoLiberado } from '@/lib/gating'
import { modulosEfetivos } from '@/lib/modulos'
import { Sidebar } from '@/components/crm/sidebar'
import { Topbar } from '@/components/crm/topbar'
import { BannerAssinatura } from '@/components/crm/banner-assinatura'
import { Toaster } from '@/components/ui/sonner'
import { TourBoasVindas } from '@/components/crm/tour-boas-vindas'
import type { Profile } from '@/types'

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, empresaId, plano, status, supabase } = await getAuthUser()

  // Conta sem empresa → fluxo de vinculação por código
  if (!empresaId) redirect('/entrar/empresa')

  // Assinatura suspensa/cancelada → paywall (sem loop: /assinatura fica fora deste grupo)
  if (!acessoLiberado(status)) redirect('/assinatura')

  // Carrega overrides/add-ons da empresa (sem service role — RLS garante acesso)
  const { data: empresaData } = await supabase
    .from('empresas')
    .select('modulos_ativos, modulos_ocultos')
    .eq('id', empresaId)
    .single()

  const modulosAtivosExtras: string[] = empresaData?.modulos_ativos ?? []
  const modulosOcultos: string[] = empresaData?.modulos_ocultos ?? []

  // Conjunto efetivo de módulos para esta empresa, subtraindo os que o admin optou por ocultar
  const modulosAtivos = Array.from(modulosEfetivos(plano, modulosAtivosExtras))
    .filter((m) => !modulosOcultos.includes(m))

  // Busca o profile completo para Sidebar/Topbar
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Banner de aviso de assinatura (trial / pendente / atrasado) */}
      <BannerAssinatura status={status} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar profile={profile as Profile} modulosAtivos={modulosAtivos} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar profile={profile as Profile} />
          <main className="flex-1 overflow-y-auto p-6 crm-grid-texture">{children}</main>
        </div>
      </div>

      <Toaster richColors position="top-right" theme="dark" />
      <TourBoasVindas />
    </div>
  )
}

// TODO (2ª onda): adicionar checagem de temModulo nas Server Actions de cada módulo.
// TODO (2ª onda): adicionar RLS por módulo no banco (coluna modulo em tabelas gateadas).
