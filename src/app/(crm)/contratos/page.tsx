import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContratosView } from '@/components/crm/contratos/contratos-view'

export default async function ContratosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <ContratosView />
}
