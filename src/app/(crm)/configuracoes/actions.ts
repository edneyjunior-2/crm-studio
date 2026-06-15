'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthAdmin } from '@/lib/auth'
import { encarregadoSchema } from '@/lib/schemas'

export async function createUser(
  email: string,
  password: string,
  role: string,
  fullName: string
): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const admin = createAdminClient()

  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // empresa_id no metadata: o trigger handle_new_user adiciona o membro à empresa do admin
    // (em vez de criar uma empresa nova, que é o caminho do cadastro self-serve).
    user_metadata: { full_name: fullName, role, empresa_id: empresaId },
  })

  if (createError) return { error: createError.message }

  const userId = authData.user?.id
  if (!userId) return { error: 'Erro ao criar usuário.' }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: userId, full_name: fullName, role, empresa_id: empresaId })

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: profileError.message }
  }

  revalidatePath('/configuracoes')
  return {}
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<{ error?: string }> {
  const { supabase, user: adminUser } = await getAuthAdmin()
  const adminId = adminUser.id

  if (userId === adminId) return { error: 'Não é possível alterar o próprio perfil.' }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

export async function salvarEncarregado(
  data: unknown
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const parsed = encarregadoSchema.safeParse(data)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join('; ')
    return { error: msg }
  }

  const { error } = await supabase
    .from('empresas')
    .update({
      encarregado_nome: parsed.data.encarregado_nome ?? null,
      encarregado_email: parsed.data.encarregado_email ?? null,
      encarregado_telefone: parsed.data.encarregado_telefone ?? null,
    })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const { user: adminUser } = await getAuthAdmin()
  const adminId = adminUser.id

  if (userId === adminId) return { error: 'Não é possível excluir a própria conta.' }

  const admin = createAdminClient()

  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}
