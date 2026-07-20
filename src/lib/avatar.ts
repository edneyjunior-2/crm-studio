import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Signed URL de 1h — expira bem depois de qualquer navegação normal; se
 *  expirar mesmo assim (aba ficou aberta), a próxima renderização do server
 *  component gera outra sem qualquer ação do usuário. */
const AVATAR_SIGNED_URL_TTL_SECONDS = 3600

/**
 * Resolve a signed URL da foto de perfil a partir do `avatar_path` salvo em
 * `profiles`. Bucket `avatars` é privado (nunca usar getPublicUrl — ver
 * migration 20260720120000_avatar_perfil.sql). Usa o client autenticado do
 * próprio request: a policy `avatars_select` do Storage já restringe a
 * leitura aos colegas da mesma empresa, então createSignedUrl aqui herda essa
 * regra automaticamente.
 *
 * Nunca lança: retorna `null` quando não há foto ou a geração falha por
 * qualquer motivo — a UI sempre degrada pro fallback de iniciais.
 */
export async function resolverAvatarUrl(
  supabase: SupabaseServerClient,
  avatarPath: string | null | undefined
): Promise<string | null> {
  if (!avatarPath) return null

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS)

  if (error) return null
  return data?.signedUrl ?? null
}
