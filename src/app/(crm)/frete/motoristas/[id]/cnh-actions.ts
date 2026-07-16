'use server'

/**
 * cnh-actions.ts — Upload de foto/PDF da CNH do motorista + OCR (Google Vision)
 *
 * Spec: .claude/specs/frete-03-ocr-cnh.md
 *
 * ponytail: OCR roda síncrono na própria Server Action (upload é raro, um
 * motorista por vez — não precisa de fila/job assíncrono nem retry automático).
 *
 * `aplicarDadosCnhAoMotorista` é AUTOCONTIDA: não importa de
 * `motoristas/actions.ts` (outro stream, em paralelo) — faz um UPDATE direto e
 * mínimo em `frete_motoristas`.
 */

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import { extrairTextoImagem, parsearCamposCnh, type CnhDadosExtraidos } from '@/lib/frete/cnh-ocr-parser'

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024 // 10 MB
// PDF removido da whitelist: o endpoint do Vision usado aqui (images:annotate)
// não rasteriza PDF — aceitar o upload sem nunca conseguir ler prometeria uma
// leitura automática que não funciona (achado de review 2026-07-16).
const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ProcessarUploadCnhResultado {
  sucesso: boolean
  dados?: CnhDadosExtraidos
  erro?: string
}

/**
 * 1. Valida arquivo (tipo/tamanho) e o motorista dono.
 * 2. Sobe pro bucket `frete-motoristas-docs`.
 * 3. Insere `frete_motoristas_documentos` com ocr_status='pendente'. Se o
 *    insert falhar, remove o arquivo já subido (compensação manual, mesmo
 *    padrão de rh/documentos-actions.ts).
 * 4. Roda o OCR síncrono e sempre termina em ocr_status='processado' ou
 *    'erro' — nunca deixa a linha em 'pendente'.
 */
export async function processarUploadCnh(
  motoristaId: string,
  formData: FormData
): Promise<ProcessarUploadCnhResultado> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { sucesso: false, erro: erroModulo }

  if (!motoristaId || !UUID_REGEX.test(motoristaId)) {
    return { sucesso: false, erro: 'Motorista inválido.' }
  }

  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { sucesso: false, erro: 'Empresa não encontrada no contexto.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { sucesso: false, erro: 'Arquivo obrigatório.' }
  }
  // Validação server-side de tipo/tamanho — nunca confiar só no accept="..." do client.
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    return { sucesso: false, erro: 'Arquivo muito grande. Limite: 10 MB.' }
  }
  if (!MIME_PERMITIDOS.includes(file.type)) {
    return { sucesso: false, erro: 'Tipo de arquivo não permitido. Envie PDF, JPEG, PNG ou WEBP.' }
  }

  // Confirma que o motorista existe e pertence à empresa do usuário (RLS já
  // isola por tenant; a checagem explícita aqui dá um erro claro em vez de um
  // insert órfão silencioso caso o id não exista).
  const { data: motorista, error: motoristaErro } = await supabase
    .from('frete_motoristas')
    .select('id')
    .eq('id', motoristaId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (motoristaErro) return { sucesso: false, erro: motoristaErro.message }
  if (!motorista) return { sucesso: false, erro: 'Motorista não encontrado.' }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${empresaId}/${motoristaId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErro } = await supabase.storage
    .from('frete-motoristas-docs')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (uploadErro) return { sucesso: false, erro: `Erro no upload: ${uploadErro.message}` }

  const { data: inserido, error: insertErro } = await supabase
    .from('frete_motoristas_documentos')
    .insert({
      motorista_id: motoristaId,
      tipo: 'cnh',
      storage_path: path,
      mime_type: file.type || null,
      tamanho: file.size,
      created_by: user.id,
      // empresa_id é carimbado pelo trigger set_empresa_id — não setar aqui.
    })
    .select('id')
    .single()

  if (insertErro) {
    // Insert falhou: remove o arquivo já subido pra não deixar órfão no bucket.
    await supabase.storage.from('frete-motoristas-docs').remove([path])
    return { sucesso: false, erro: `Erro ao registrar documento: ${insertErro.message}` }
  }

  // OCR síncrono. Qualquer caminho abaixo termina a linha em 'processado' ou
  // 'erro' — nunca fica 'pendente' pra sempre.
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    const textoOcr = await extrairTextoImagem(base64)
    const dados = parsearCamposCnh(textoOcr)

    const { error: updateErro } = await supabase
      .from('frete_motoristas_documentos')
      .update({ ocr_status: 'processado', ocr_dados: dados })
      .eq('id', inserido.id)

    if (updateErro) {
      // Documento e arquivo já estão salvos — o erro é só no carimbo do
      // resultado do OCR. Reporta pro usuário, mas não desfaz o upload.
      return { sucesso: false, erro: `Documento salvo, mas falha ao registrar OCR: ${updateErro.message}` }
    }

    revalidatePath(`/frete/motoristas/${motoristaId}`)
    return { sucesso: true, dados }
  } catch (ocrErro) {
    const mensagem = ocrErro instanceof Error ? ocrErro.message : 'Erro desconhecido ao processar OCR.'

    await supabase
      .from('frete_motoristas_documentos')
      .update({ ocr_status: 'erro', ocr_erro: mensagem })
      .eq('id', inserido.id)

    revalidatePath(`/frete/motoristas/${motoristaId}`)
    return { sucesso: false, erro: mensagem }
  }
}

/**
 * Server Action separada e self-contida (NÃO importa de motoristas/actions.ts
 * de outro stream): recebe os campos já confirmados pelo usuário no client e
 * faz um UPDATE direto e mínimo em frete_motoristas — só os campos
 * não-vazios recebidos.
 */
export async function aplicarDadosCnhAoMotorista(
  motoristaId: string,
  dados: Partial<CnhDadosExtraidos>
): Promise<{ sucesso: boolean; erro?: string }> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { sucesso: false, erro: erroModulo }

  if (!motoristaId || !UUID_REGEX.test(motoristaId)) {
    return { sucesso: false, erro: 'Motorista inválido.' }
  }

  const { supabase } = await getAuthUser()

  const patch: Record<string, string> = {}
  if (dados.nome?.trim()) patch.nome = dados.nome.trim()
  if (dados.cpf?.trim()) patch.cpf = dados.cpf.trim()
  if (dados.cnhNumero?.trim()) patch.cnh_numero = dados.cnhNumero.trim()
  if (dados.cnhCategoria?.trim()) patch.cnh_categoria = dados.cnhCategoria.trim()
  if (dados.cnhValidade?.trim()) patch.cnh_validade = dados.cnhValidade.trim()

  if (Object.keys(patch).length === 0) {
    return { sucesso: false, erro: 'Nenhum campo para aplicar.' }
  }

  // empresa_id implícito via RLS (UPDATE, não INSERT — tenant_isolation já restringe ao empresa_id atual).
  const { error } = await supabase
    .from('frete_motoristas')
    .update(patch)
    .eq('id', motoristaId)

  if (error) return { sucesso: false, erro: error.message }

  revalidatePath(`/frete/motoristas/${motoristaId}`)
  return { sucesso: true }
}
