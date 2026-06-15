import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/crm/sidebar'
import { Topbar } from '@/components/crm/topbar'
import { Toaster } from '@/components/ui/sonner'
import { TourBoasVindas } from '@/components/crm/tour-boas-vindas'
import type { Profile } from '@/types'

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar profile={profile as Profile} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar profile={profile as Profile} />
        <main className="flex-1 overflow-y-auto p-6 crm-grid-texture">{children}</main>
      </div>
      <Toaster richColors position="top-right" theme="dark" />
      <TourBoasVindas />
    </div>
  )
}
