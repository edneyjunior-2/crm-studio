'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'

export async function uploadContrato(
  parceiroId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, role } = await getAuthUser()
  if (role === 'parceiro') return { error: 'Acesso negado.' }

  const file = formData.get('contrato') as File | null
  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado.' }

  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) return { error: 'O arquivo deve ter no máximo 10 MB.' }

  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowed.includes(file.type)) {
    return { error: 'Formato inválido. Envie PDF, DOC ou DOCX.' }
  }

  const { data: parceiro, error: fetchError } = await supabase
    .from('parceiros')
    .select('contrato_url')
    .eq('id', parceiroId)
    .single()

  if (fetchError || !parceiro) return { error: 'Parceiro não encontrado.' }

  const admin = createAdminClient()

  if (parceiro.contrato_url) {
    await admin.storage.from('contratos').remove([parceiro.contrato_url])
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const path = `contratos/${parceiroId}/${Date.now()}_${file.name}`

  const { error: uploadError } = await admin.storage
    .from('contratos')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { error: updateError } = await supabase
    .from('parceiros')
    .update({ contrato_url: path, contrato_nome: file.name })
    .eq('id', parceiroId)

  if (updateError) {
    await admin.storage.from('contratos').remove([path])
    return { error: updateError.message }
  }

  revalidatePath(`/parceiros/${parceiroId}`)
  return {}
}

export async function removeContrato(
  parceiroId: string
): Promise<{ error?: string }> {
  const { supabase, role } = await getAuthUser()
  if (role === 'parceiro') return { error: 'Acesso negado.' }

  const { data: parceiro, error: fetchError } = await supabase
    .from('parceiros')
    .select('contrato_url')
    .eq('id', parceiroId)
    .single()

  if (fetchError || !parceiro) return { error: 'Parceiro não encontrado.' }
  if (!parceiro.contrato_url) return { error: 'Nenhum contrato para remover.' }

  const admin = createAdminClient()
  const { error: removeError } = await admin.storage
    .from('contratos')
    .remove([parceiro.contrato_url])

  if (removeError) return { error: removeError.message }

  const { error: updateError } = await supabase
    .from('parceiros')
    .update({ contrato_url: null, contrato_nome: null })
    .eq('id', parceiroId)

  if (updateError) return { error: updateError.message }

  revalidatePath(`/parceiros/${parceiroId}`)
  return {}
}

export async function getContratoUrl(
  parceiroId: string
): Promise<{ url?: string; error?: string }> {
  const { supabase, role } = await getAuthUser()
  if (role === 'parceiro') return { error: 'Acesso negado.' }

  const { data: parceiro, error: fetchError } = await supabase
    .from('parceiros')
    .select('contrato_url')
    .eq('id', parceiroId)
    .single()

  if (fetchError || !parceiro) return { error: 'Parceiro não encontrado.' }
  if (!parceiro.contrato_url) return { error: 'Nenhum contrato cadastrado.' }

  const admin = createAdminClient()
  const { data, error: signError } = await admin.storage
    .from('contratos')
    .createSignedUrl(parceiro.contrato_url, 60)

  if (signError || !data?.signedUrl) return { error: 'Erro ao gerar URL do contrato.' }

  return { url: data.signedUrl }
}
