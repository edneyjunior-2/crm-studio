'use server'

/**
 * avatar-actions.ts — troca da foto de perfil (Minha Conta)
 *
 * Mesma lógica de solidez do upload de CNH (ver
 * frete/motoristas/[id]/cnh-actions.ts): sobe pro Storage primeiro, só depois
 * grava o path em `profiles`; se o UPDATE falhar, remove o arquivo recém-subido
 * pra não deixar órfão no bucket. Ao trocar com sucesso, remove também a foto
 * anterior (evita acumular arquivo sem dono a cada troca).
 *
 * Nunca confia em id vindo do client — sempre usa `user.id` de getAuthUser().
 */

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'
import { avatarUploadSchema } from '@/lib/schemas'

const BUCKET = 'avatars'

export interface AtualizarAvatarResultado {
  sucesso: boolean
  avatarUrl?: string | null
  erro?: string
}

export async function atualizarAvatar(formData: FormData): Promise<AtualizarAvatarResultado> {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { sucesso: false, erro: 'Empresa não encontrada no contexto.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { sucesso: false, erro: 'Selecione uma imagem.' }
  }

  // Validação server-side de tipo/tamanho — nunca confiar só no accept="..." do client.
  const parsed = avatarUploadSchema.safeParse({ type: file.type, size: file.size })
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? 'Arquivo inválido.' }
  }

  // Guarda o path anterior para remover depois da troca (evita acúmulo de órfãos no bucket).
  const { data: profileAtual } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', user.id)
    .single()
  const pathAnterior = profileAtual?.avatar_path as string | null | undefined

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${empresaId}/${user.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErro } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadErro) return { sucesso: false, erro: `Erro no upload: ${uploadErro.message}` }

  const { error: updateErro } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', user.id)

  if (updateErro) {
    // UPDATE falhou: remove o arquivo já subido pra não deixar órfão no bucket.
    await supabase.storage.from(BUCKET).remove([path])
    return { sucesso: false, erro: `Erro ao salvar a foto: ${updateErro.message}` }
  }

  // Troca concluída — remove a foto anterior (best-effort; falha aqui não desfaz a troca já salva).
  if (pathAnterior) {
    await supabase.storage.from(BUCKET).remove([pathAnterior])
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)

  revalidatePath('/minha-conta')
  // Sidebar/topbar (dentro do layout do grupo (crm)) mostram a mesma foto —
  // revalida o layout inteiro pra próxima navegação carregar a imagem nova.
  revalidatePath('/', 'layout')

  return { sucesso: true, avatarUrl: signed?.signedUrl ?? null }
}
