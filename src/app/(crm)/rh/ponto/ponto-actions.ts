'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'

export async function upsertPonto(
  colaboradorId: string,
  data: string,
  presente: boolean,
  justificativa?: string | null,
): Promise<{ error?: string }> {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  if (!colaboradorId || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { error: 'Dados inválidos.' }
  }

  const { error } = await supabase
    .from('pontos')
    .upsert(
      {
        colaborador_id: colaboradorId,
        empresa_id: empresaId,
        data,
        presente,
        justificativa: justificativa?.trim() || null,
        created_by: user.id,
      },
      { onConflict: 'colaborador_id,data' },
    )

  if (error) return { error: error.message }

  revalidatePath('/rh/ponto')
  return {}
}

export async function uploadDocumentoPonto(
  formData: FormData,
): Promise<{ error?: string; path?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const colaboradorId = formData.get('colaborador_id')
  const data          = formData.get('data')
  const file          = formData.get('file')

  if (typeof colaboradorId !== 'string' || !colaboradorId) return { error: 'Colaborador inválido.' }
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return { error: 'Data inválida.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Arquivo obrigatório.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'Arquivo muito grande (máx 10 MB).' }

  const { data: ponto } = await supabase
    .from('pontos')
    .select('id, presente')
    .eq('colaborador_id', colaboradorId)
    .eq('data', data)
    .single()

  if (!ponto) return { error: 'Registre a falta antes de anexar o documento.' }
  if (ponto.presente) return { error: 'Documento é permitido apenas para faltas.' }

  const ext       = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const safeName  = `atestado.${ext}`
  const path      = `${empresaId}/ponto/${colaboradorId}/${data}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('rh-documentos')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true })

  if (uploadError) return { error: `Erro no upload: ${uploadError.message}` }

  const { error: updateError } = await supabase
    .from('pontos')
    .update({ documento_path: path })
    .eq('id', ponto.id)

  if (updateError) {
    await supabase.storage.from('rh-documentos').remove([path])
    return { error: updateError.message }
  }

  revalidatePath('/rh/ponto')
  return { path }
}

export async function removerDocumentoPonto(
  colaboradorId: string,
  data: string,
): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()

  const { data: ponto } = await supabase
    .from('pontos')
    .select('id, documento_path')
    .eq('colaborador_id', colaboradorId)
    .eq('data', data)
    .single()

  if (!ponto?.documento_path) return {}

  await supabase.storage.from('rh-documentos').remove([ponto.documento_path])

  const { error } = await supabase
    .from('pontos')
    .update({ documento_path: null })
    .eq('id', ponto.id)

  if (error) return { error: error.message }

  revalidatePath('/rh/ponto')
  return {}
}

export async function gerarUrlDocumentoPonto(
  colaboradorId: string,
  data: string,
): Promise<{ url?: string; error?: string }> {
  const { supabase } = await getAuthUser()

  const { data: ponto } = await supabase
    .from('pontos')
    .select('documento_path')
    .eq('colaborador_id', colaboradorId)
    .eq('data', data)
    .single()

  if (!ponto?.documento_path) return { error: 'Nenhum documento encontrado.' }

  const { data: signed, error } = await supabase.storage
    .from('rh-documentos')
    .createSignedUrl(ponto.documento_path, 60)

  if (error || !signed?.signedUrl) return { error: 'Erro ao gerar link de acesso.' }

  return { url: signed.signedUrl }
}
