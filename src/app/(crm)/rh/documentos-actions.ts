'use server'

import { revalidatePath } from 'next/cache'
import { getAuthAdmin } from '@/lib/auth'
import { uploadDocumentoSchema } from '@/lib/schemas-rh'
import { TIPOS_SENSIVEIS } from '@/types/rh'
import type { ColaboradorDocumento } from '@/types/rh'

// URL assinada expira em 60 segundos (Art. 46 LGPD — acesso temporário e controlado)
const SIGNED_URL_EXPIRES_IN = 60

// ============================================================================
// Helpers
// ============================================================================

/** Gera o caminho do objeto no Storage: <empresa_id>/<colaborador_id>/<uuid>-<nome_sanitizado> */
function buildStoragePath(empresaId: string, colaboradorId: string, nomeOriginal: string): string {
  const uuid = crypto.randomUUID()
  // Sanitiza o nome do arquivo: remove caracteres especiais exceto ponto e hífen
  const nomeSanitizado = nomeOriginal
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .slice(0, 200)
  return `${empresaId}/${colaboradorId}/${uuid}-${nomeSanitizado}`
}

/** Registra um acesso ao log de auditoria (Art. 6º LGPD — accountability) */
async function logarAcesso(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  documentoId: string,
  acao: 'upload' | 'download' | 'delete',
  userId: string
): Promise<void> {
  const { error } = await supabase.from('colaborador_documentos_acessos').insert({
    documento_id: documentoId,
    acao,
    user_id: userId,
    // empresa_id é carimbado pelo trigger set_empresa_id
  })
  // Log não bloqueia a operação principal mas não deve ser silenciado
  if (error) {
    console.error('[RH-LGPD] Erro ao registrar log de acesso:', error.message)
  }
}

// ============================================================================
// AC4 — Server Actions (admin-only)
// ============================================================================

/**
 * Upload de documento para o colaborador.
 * Grava no Storage (bucket privado rh-documentos) e insere a linha na tabela.
 * Registra log de acesso 'upload' (Art. 6º LGPD).
 */
export async function uploadDocumento(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, user, empresaId } = await getAuthAdmin()

  if (!empresaId) return { error: 'Empresa não encontrada no contexto.' }

  const raw = {
    colaborador_id: formData.get('colaborador_id'),
    tipo: formData.get('tipo'),
    sensivel: formData.get('sensivel') === 'true',
  }

  const parsed = uploadDocumentoSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Arquivo obrigatório.' }
  }

  // Limite de 50 MB
  if (file.size > 52_428_800) {
    return { error: 'Arquivo muito grande. Limite: 50 MB.' }
  }

  // Tipos sensíveis (saúde/ASO) são automaticamente marcados como sensivel=true
  const isSensivel =
    parsed.data.sensivel ||
    TIPOS_SENSIVEIS.includes(parsed.data.tipo as (typeof TIPOS_SENSIVEIS)[number])

  const storagePath = buildStoragePath(empresaId, parsed.data.colaborador_id, file.name)

  // Upload para o Storage (bucket privado)
  const { error: uploadError } = await supabase.storage
    .from('rh-documentos')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return { error: `Erro no upload: ${uploadError.message}` }
  }

  // Insere o registro na tabela
  const { data: inserted, error: insertError } = await supabase
    .from('colaborador_documentos')
    .insert({
      colaborador_id: parsed.data.colaborador_id,
      tipo: parsed.data.tipo,
      nome_original: file.name,
      storage_path: storagePath,
      sensivel: isSensivel,
      mime: file.type || null,
      tamanho_bytes: file.size,
      uploaded_by: user.id,
      // empresa_id é carimbado pelo trigger
    })
    .select('id')
    .single()

  if (insertError) {
    // Tenta remover o arquivo do Storage se o insert falhar
    await supabase.storage.from('rh-documentos').remove([storagePath])
    return { error: `Erro ao registrar documento: ${insertError.message}` }
  }

  // Log de auditoria (Art. 6º LGPD)
  await logarAcesso(supabase, inserted.id, 'upload', user.id)

  revalidatePath('/rh')
  return {}
}

/**
 * Lista todos os documentos de um colaborador.
 * Retorna array vazio se não houver documentos.
 */
export async function listarDocumentos(
  colaboradorId: string
): Promise<{ data?: ColaboradorDocumento[]; error?: string }> {
  if (!colaboradorId || !/^[0-9a-f-]{36}$/i.test(colaboradorId)) {
    return { error: 'ID de colaborador inválido.' }
  }

  const { supabase } = await getAuthAdmin()

  const { data, error } = await supabase
    .from('colaborador_documentos')
    .select('*')
    .eq('colaborador_id', colaboradorId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  return { data: (data ?? []) as ColaboradorDocumento[] }
}

/**
 * Gera URL assinada com expiração curta (60s) para download seguro.
 * Registra log de acesso 'download' (Art. 6º LGPD).
 * Nunca expõe URL pública (Art. 46 LGPD — segurança).
 */
export async function gerarUrlDownload(
  documentoId: string
): Promise<{ url?: string; error?: string }> {
  if (!documentoId || !/^[0-9a-f-]{36}$/i.test(documentoId)) {
    return { error: 'ID de documento inválido.' }
  }

  const { supabase, user } = await getAuthAdmin()

  // Busca o documento (RLS garante isolamento de tenant)
  const { data: documento, error: fetchError } = await supabase
    .from('colaborador_documentos')
    .select('id, storage_path')
    .eq('id', documentoId)
    .single()

  if (fetchError || !documento) {
    return { error: 'Documento não encontrado.' }
  }

  // Gera URL assinada de curta duração (Art. 46 LGPD)
  const { data: signed, error: signError } = await supabase.storage
    .from('rh-documentos')
    .createSignedUrl(documento.storage_path, SIGNED_URL_EXPIRES_IN)

  if (signError || !signed?.signedUrl) {
    return { error: `Erro ao gerar link de download: ${signError?.message ?? 'desconhecido'}` }
  }

  // Log de auditoria (Art. 6º LGPD)
  await logarAcesso(supabase, documento.id, 'download', user.id)

  return { url: signed.signedUrl }
}

/**
 * Remove o documento do Storage e da tabela.
 * Registra log de acesso 'delete' antes da remoção (Art. 6º LGPD).
 */
export async function excluirDocumento(
  documentoId: string
): Promise<{ error?: string }> {
  if (!documentoId || !/^[0-9a-f-]{36}$/i.test(documentoId)) {
    return { error: 'ID de documento inválido.' }
  }

  const { supabase, user } = await getAuthAdmin()

  // Busca o documento para obter o path antes de deletar
  const { data: documento, error: fetchError } = await supabase
    .from('colaborador_documentos')
    .select('id, storage_path')
    .eq('id', documentoId)
    .single()

  if (fetchError || !documento) {
    return { error: 'Documento não encontrado.' }
  }

  // Registra o log ANTES de deletar (preserva evidência — Art. 6º LGPD)
  await logarAcesso(supabase, documento.id, 'delete', user.id)

  // Remove o arquivo do Storage
  const { error: storageError } = await supabase.storage
    .from('rh-documentos')
    .remove([documento.storage_path])

  if (storageError) {
    return { error: `Erro ao remover arquivo: ${storageError.message}` }
  }

  // Remove a linha da tabela
  const { error: deleteError } = await supabase
    .from('colaborador_documentos')
    .delete()
    .eq('id', documentoId)

  if (deleteError) {
    return { error: `Erro ao remover registro: ${deleteError.message}` }
  }

  revalidatePath('/rh')
  return {}
}
