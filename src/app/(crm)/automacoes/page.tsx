import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AutomacoesContent } from '@/components/crm/automacoes/automacoes-content'

export default async function AutomacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  return <AutomacoesContent />
}
