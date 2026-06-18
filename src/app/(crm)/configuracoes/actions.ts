'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthAdmin } from '@/lib/auth'
import { encarregadoSchema } from '@/lib/schemas'
import { z } from 'zod'

const roleSchema = z.enum(['admin', 'socio', 'comercial'])

export async function createUser(
  email: string,
  password: string,
  role: string,
  fullName: string
): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const roleResult = roleSchema.safeParse(role)
  if (!roleResult.success) return { error: 'Role inválido' }
  role = roleResult.data

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

  const roleResult = roleSchema.safeParse(role)
  if (!roleResult.success) return { error: 'Role inválido' }
  role = roleResult.data

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

export async function toggleModuloVisibilidade(
  modulo: string,
  ocultar: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, empresa_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Sem permissão' }

  const empresaId = profile.empresa_id as string
  const { data: empresa } = await supabase
    .from('empresas')
    .select('modulos_ocultos')
    .eq('id', empresaId)
    .single()

  const atual: string[] = empresa?.modulos_ocultos ?? []
  const novo = ocultar
    ? [...new Set([...atual, modulo])]
    : atual.filter((m) => m !== modulo)

  const { error } = await supabase
    .from('empresas')
    .update({ modulos_ocultos: novo })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const { user: adminUser } = await getAuthAdmin()
  const adminId = adminUser.id

  if (userId === adminId) return { error: 'Não é possível excluir a própria conta.' }

  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', userId)
    .single()

  if (!target || target.empresa_id !== empresaId) {
    return { error: 'Usuário não pertence a esta empresa' }
  }

  const admin = createAdminClient()

  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}
