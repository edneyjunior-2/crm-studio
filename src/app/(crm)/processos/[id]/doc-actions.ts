'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export interface DocItem {
  id:           string
  nome:         string
  storage_path: string
  mime_type:    string | null
  tamanho:      number | null
  created_at:   string
  autor_nome:   string | null
}

export async function uploadDocumento(
  fd: FormData,
): Promise<{ documento?: DocItem; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const file       = fd.get('file') as File | null
  const processoId = (fd.get('processoId') as string)?.trim()
  if (!file || !processoId) return { error: 'Arquivo ou processo inválido.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'Arquivo muito grande. Limite: 10 MB.' }

  const { empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { data: proc } = await supabase
    .from('processos_juridicos').select('id')
    .eq('id', processoId).eq('empresa_id', empresaId).single()
  if (!proc) return { error: 'Processo não encontrado.' }

  const ext  = file.name.split('.').pop() ?? 'bin'
  const path = `${user.id}/${processoId}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('processos-docs').upload(path, file, { contentType: file.type })
  if (upErr) return { error: upErr.message }

  const { data: doc, error: dbErr } = await supabase
    .from('processos_documentos')
    .insert({
      processo_id:  processoId,
      autor_id:     user.id,
      nome:         file.name,
      storage_path: path,
      mime_type:    file.type || null,
      tamanho:      file.size,
    })
    .select('id, nome, storage_path, mime_type, tamanho, created_at')
    .single()

  if (dbErr) {
    await supabase.storage.from('processos-docs').remove([path])
    return { error: dbErr.message }
  }

  revalidatePath(`/processos/${processoId}`)
  return { documento: { ...doc, autor_nome: null } }
}

export async function excluirDocumento(
  docId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase
    .from('processos_documentos').delete().eq('id', docId).select('processo_id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Sem permissão para excluir este documento.' }

  await supabase.storage.from('processos-docs').remove([storagePath])
  revalidatePath(`/processos/${data[0].processo_id}`)
  return {}
}
