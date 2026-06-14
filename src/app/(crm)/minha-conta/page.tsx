import { redirect } from 'next/navigation'
import { UserCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { GoogleCalendarConnect } from '@/components/crm/google/google-calendar-connect'
import { GoogleConnectFeedback } from '@/components/crm/google/google-connect-feedback'

export default async function MinhaContaPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, google_refresh_token')
    .eq('id', user.id)
    .single()

  const params = await searchParams
  const googleStatus = params.google

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    socio: 'Sócio',
    comercial: 'Comercial',
  }

  return (
    <div className="flex flex-col gap-8">
      <GoogleConnectFeedback status={googleStatus} />

      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <UserCircle className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
            Minha Conta
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gerencie suas preferências e integrações.
          </p>
        </div>
      </div>

      {/* Informações do perfil */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Perfil</h3>
          <p className="text-sm text-muted-foreground">Suas informações no CRM Studio.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Nome</p>
              <p className="mt-1 text-sm font-medium text-foreground">{profile?.full_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Perfil de acesso</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {profile?.role ? (roleLabel[profile.role] ?? profile.role) : '—'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Integrações */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Integrações</h3>
          <p className="text-sm text-muted-foreground">
            Conecte ferramentas externas para automatizar seu fluxo de trabalho.
          </p>
        </div>
        <GoogleCalendarConnect isConnected={!!profile?.google_refresh_token} />
      </section>
    </div>
  )
}
