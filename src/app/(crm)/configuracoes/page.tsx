import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UsuariosTable } from '@/components/crm/configuracoes/usuarios-table'
import { InviteUserForm } from '@/components/crm/configuracoes/invite-user-form'
import type { Profile, Role } from '@/types'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const [profilesResult, authUsersResult] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    admin.auth.admin.listUsers(),
  ])

  const profiles: Profile[] = (profilesResult.data ?? []) as Profile[]
  const authUsers = authUsersResult.data?.users ?? []

  const emailByUserId = new Map(authUsers.map((u) => [u.id, u.email ?? '']))

  const usuarios = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailByUserId.get(p.id) ?? '—',
    role: p.role as Role,
    created_at: p.created_at,
  }))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Settings className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Configurações</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gerencie os usuários e permissões do CRM Aurum.
            </p>
          </div>
        </div>
        <InviteUserForm />
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Usuários</h3>
          <p className="text-sm text-muted-foreground">
            {usuarios.length} {usuarios.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
          </p>
        </div>

        {profilesResult.error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
            <p className="text-sm text-destructive">
              Erro ao carregar usuários. Tente novamente mais tarde.
            </p>
          </div>
        ) : (
          <UsuariosTable usuarios={usuarios} currentUserId={user.id} />
        )}
      </section>
    </div>
  )
}
