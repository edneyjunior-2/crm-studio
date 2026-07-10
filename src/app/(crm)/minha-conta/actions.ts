'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'
import { oabSchema } from '@/lib/schemas'

/**
 * Self-service: o advogado autenticado cadastra a própria OAB (número + UF).
 * Usa a auth do próprio usuário (não a de admin) e atualiza SEMPRE profiles.id
 * do usuário da sessão — nunca aceita um userId por parâmetro, para impedir
 * que alguém edite a OAB de outra pessoa.
 */
export async function updateOwnOab(
  oabNumero: string,
  oabUf: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser()

  const parsed = oabSchema.safeParse({ oabNumero, oabUf })
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join('; ')
    return { error: msg }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      oab_numero: parsed.data.oabNumero,
      oab_uf: parsed.data.oabUf,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/minha-conta')
  return {}
}
