'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Chamada pelo client (definir-senha/page.tsx) depois que
 * `supabase.auth.updateUser({ password })` já trocou a senha com sucesso.
 * Marca `senha_temporaria = false` — a partir daqui o gate em (crm)/layout.tsx
 * para de redirecionar este profile para /definir-senha.
 *
 * A policy RLS "profiles: usuario atualiza o proprio" (id = auth.uid()) já
 * cobre este UPDATE (ver 001_initial_schema.sql); não precisa de policy nova.
 *
 * ponytail: usa o client autenticado da sessão (não getAuthUser()) — só
 * precisamos do id do usuário logado, não de role/plano/empresa.
 */
export async function completarPrimeiroAcesso(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .update({ senha_temporaria: false })
    .eq('id', user.id)

  if (error) return { error: 'Não foi possível concluir seu acesso. Tente novamente.' }

  redirect('/dashboard')
}
