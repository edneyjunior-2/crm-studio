'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server actions do inbox de Atendimento (conversas do SDR / WhatsApp).
 *
 * `conversations` e `messages` NÃO têm RLS (deny-all p/ client de usuário), então
 * escrevemos via admin client (service_role). A autorização + isolamento de tenant
 * são garantidos aqui: resolvemos a empresa do usuário e filtramos por empresa_id.
 */
async function authEmpresa(): Promise<{ empresaId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: perfil } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).single()
  if (!perfil?.empresa_id) redirect('/login')
  return { empresaId: perfil.empresa_id }
}

/** Humano assume a conversa: status=humano e o bot cala (ia_ativa=false). */
export async function assumirConversa(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'humano', ia_ativa: false })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Devolve ao bot: status=bot e a IA volta a responder (ia_ativa=true). */
export async function devolverAoBot(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'bot', ia_ativa: true })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Marca a conversa como resolvida. */
export async function resolverConversa(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'resolvido' })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Zera o contador de não lidas da conversa. */
export async function marcarLida(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/**
 * Salva o número do WhatsApp do atendimento (vira o número do robô para esta
 * empresa). Deve ser o MESMO número liberado na WhatsApp Cloud API da Meta.
 */
export async function salvarNumeroAtendimento(numero: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const num = numero?.trim()
  if (!num) return { error: 'Informe o número do WhatsApp.' }

  const admin = createAdminClient()
  const { data: existente } = await admin
    .from('clientes_sdr')
    .select('id')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  const { error } = existente?.id
    ? await admin.from('clientes_sdr').update({ wa_phone_number_id: num, updated_at: new Date().toISOString() }).eq('id', existente.id)
    : await admin.from('clientes_sdr').insert({ empresa_id: empresaId, wa_phone_number_id: num, nome_assistente: 'Leila' })

  if (error) {
    if (error.code === '23505') return { error: 'Esse número já está vinculado a outra conta.' }
    return { error: error.message }
  }
  revalidatePath('/atendimento')
  return {}
}

/**
 * Inicia uma conversa manualmente (humano inicia — não o robô). Cria/reusa a
 * conversa pelo número e registra a 1ª mensagem.
 * TODO: o ENVIO real pelo WhatsApp depende do número conectado na Meta; por ora
 * a mensagem fica registrada (delivery_status='pending').
 */
export async function iniciarConversa(
  numero: string,
  mensagem: string,
): Promise<{ error?: string; id?: string }> {
  const { empresaId } = await authEmpresa()
  const num = numero?.replace(/\D/g, '')
  if (!num || num.length < 10) return { error: 'Número inválido (use DDD + número).' }
  const msg = mensagem?.trim()

  const admin = createAdminClient()
  const { data: existe } = await admin
    .from('conversations')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('wa_number', num)
    .maybeSingle()

  let convId = existe?.id
  if (!convId) {
    const { data: nova, error } = await admin
      .from('conversations')
      .insert({
        empresa_id: empresaId,
        wa_number: num,
        status: 'humano',
        ia_ativa: false,
        etapa: 'abertura',
        last_inbound_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error || !nova) return { error: error?.message ?? 'Falha ao iniciar a conversa.' }
    convId = nova.id
  }

  if (msg) {
    await admin.from('messages').insert({
      conversation_id: convId,
      direction: 'out',
      author_type: 'humano',
      texto: msg,
      delivery_status: 'pending',
    })
  }

  revalidatePath('/atendimento')
  return { id: convId }
}
