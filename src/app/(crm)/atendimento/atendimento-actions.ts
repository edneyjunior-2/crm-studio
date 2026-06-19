'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server actions do inbox de Atendimento (conversas do SDR / WhatsApp).
 *
 * As tabelas `conversations` e `messages` NÃO têm RLS (deny-all para o client
 * de usuário), então usamos o admin client (service_role) para escrever.
 * A autorização é garantida aqui via getAuthUser (auth.getUser + redirect login).
 *
 * Multi-tenant TODO: quando `conversations.empresa_id` existir, validar que a
 * conversa pertence à empresa do usuário antes de mutar (hoje é single-client).
 */
async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

/** Humano assume a conversa: status=humano e o bot cala (ia_ativa=false). */
export async function assumirConversa(id: string): Promise<{ error?: string }> {
  await requireAuth()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'humano', ia_ativa: false })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Devolve ao bot: status=bot e a IA volta a responder (ia_ativa=true). */
export async function devolverAoBot(id: string): Promise<{ error?: string }> {
  await requireAuth()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'bot', ia_ativa: true })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Marca a conversa como resolvida. */
export async function resolverConversa(id: string): Promise<{ error?: string }> {
  await requireAuth()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'resolvido' })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Zera o contador de não lidas da conversa. */
export async function marcarLida(id: string): Promise<{ error?: string }> {
  await requireAuth()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}
