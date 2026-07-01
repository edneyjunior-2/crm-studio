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

/**
 * Gera uma URL assinada (60s) para abrir/baixar um documento do processo.
 * O bucket `processos-docs` é privado. O storage_path vem do BANCO (RLS isola
 * por tenant) — nunca de parâmetro do cliente.
 */
export async function gerarUrlDownloadDocumento(
  docId: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: doc, error } = await supabase
    .from('processos_documentos')
    .select('storage_path')
    .eq('id', docId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!doc) return { error: 'Documento não encontrado.' }

  const { data: signed, error: signErr } = await supabase.storage
    .from('processos-docs')
    .createSignedUrl(doc.storage_path, 60)
  if (signErr) return { error: signErr.message }
  return { url: signed?.signedUrl }
}

export async function excluirDocumento(
  docId: string,
  _storagePath?: string, // ignorado — o path vem do banco para evitar path-injection por tenant
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // 1) Busca storage_path no banco (RLS garante isolamento por empresa) ANTES de deletar
  const { data: doc, error: fetchErr } = await supabase
    .from('processos_documentos')
    .select('storage_path, processo_id')
    .eq('id', docId)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!doc) return { error: 'Sem permissão para excluir este documento.' }

  // 2) Exclui o registro (RLS impede deleção de outros tenants)
  const { error: delErr } = await supabase
    .from('processos_documentos').delete().eq('id', docId)
  if (delErr) return { error: delErr.message }

  // 3) Remove do storage usando o path vindo do banco, não do cliente
  await supabase.storage.from('processos-docs').remove([doc.storage_path])
  revalidatePath(`/processos/${doc.processo_id}`)
  return {}
}
