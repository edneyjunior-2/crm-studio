'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { randomBytes, createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Criar empresa + usuário admin
// ---------------------------------------------------------------------------

export async function criarEmpresa(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  await getAuthPlatformAdmin()

  const nome      = (formData.get('nome') as string)?.trim()
  const email     = (formData.get('email') as string)?.trim()
  const nomeAdmin = (formData.get('nome_admin') as string)?.trim() || nome
  const plano     = (formData.get('plano') as string) || 'starter'

  if (!nome || !email) return { error: 'Nome e email são obrigatórios.' }

  const db = createAdminClient()

  // Cria o usuário no Supabase Auth — trigger handle_new_user cria empresa + profile
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      empresa_nome: nome,
      full_name:    nomeAdmin,
      role:         'admin',
    },
  })

  if (authErr) return { error: authErr.message }

  // Aguarda o trigger propagar e recupera a empresa criada
  await new Promise((r) => setTimeout(r, 500))

  const { data: profile } = await db
    .from('profiles')
    .select('empresa_id')
    .eq('id', authData.user.id)
    .single()

  if (!profile?.empresa_id) return { error: 'Empresa não foi criada pelo trigger. Verifique o banco.' }

  // Aplica o plano escolhido (trigger cria com 'free' por padrão)

  // Aplica o plano escolhido (trigger cria com 'free' por padrão)
  if (plano !== 'free') {
    await db.from('empresas').update({ plano }).eq('id', profile.empresa_id)
  }

  revalidatePath('/admin/empresas')
  redirect(`/admin/empresas/${profile.empresa_id}`)
}

// ---------------------------------------------------------------------------
// Atualizar status / plano de uma empresa
// ---------------------------------------------------------------------------

export async function atualizarEmpresa(empresaId: string, formData: FormData) {
  await getAuthPlatformAdmin()

  const status = formData.get('status') as string | null
  const plano  = formData.get('plano')  as string | null

  const updates: Record<string, string> = {}
  if (status) updates.status = status
  if (plano)  updates.plano  = plano

  if (!Object.keys(updates).length) return

  const db = createAdminClient()
  await db.from('empresas').update(updates).eq('id', empresaId)

  revalidatePath(`/admin/empresas/${empresaId}`)
}

// ---------------------------------------------------------------------------
// Gerar API key para uma empresa (retorna o token UMA VEZ)
// ---------------------------------------------------------------------------

export async function gerarApiKey(
  empresaId: string,
  label: string,
): Promise<{ token: string } | { error: string }> {
  await getAuthPlatformAdmin()

  const token   = randomBytes(32).toString('hex')
  const keyHash = createHash('sha256').update(token).digest('hex')

  const db = createAdminClient()
  const { error } = await db
    .from('api_keys')
    .insert({ empresa_id: empresaId, key_hash: keyHash, label })

  if (error) return { error: error.message }

  revalidatePath(`/admin/empresas/${empresaId}`)
  return { token }
}

// ---------------------------------------------------------------------------
// Revogar API key
// ---------------------------------------------------------------------------

export async function revogarApiKey(keyId: string, empresaId: string) {
  await getAuthPlatformAdmin()

  const db = createAdminClient()
  await db.from('api_keys').delete().eq('id', keyId).eq('empresa_id', empresaId)

  revalidatePath(`/admin/empresas/${empresaId}`)
}
