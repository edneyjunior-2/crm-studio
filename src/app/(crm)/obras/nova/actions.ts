'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'

export interface CriarObraState { error?: string; id?: string }

export async function criarObra(
  _prev: CriarObraState | null,
  formData: FormData,
): Promise<CriarObraState | null> {
  const erroModulo = await assertModulo('obras')
  if (erroModulo) return { error: erroModulo }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { error: 'Nome da obra é obrigatório.' }

  const tipo            = (formData.get('tipo') as string)?.trim() || null
  const clienteId       = (formData.get('cliente_id') as string)?.trim() || null
  const responsavelId   = (formData.get('responsavel_id') as string)?.trim() || null
  const endereco        = (formData.get('endereco') as string)?.trim() || null
  const cidade          = (formData.get('cidade') as string)?.trim() || null
  const estado          = (formData.get('estado') as string)?.trim() || null
  const artNumero       = (formData.get('art_numero') as string)?.trim() || null
  const descricao       = (formData.get('descricao') as string)?.trim() || null
  const statusRaw       = (formData.get('status') as string)?.trim()
  const status          = ['orcamento', 'em_andamento'].includes(statusRaw) ? statusRaw : 'orcamento'
  const dataInicio      = (formData.get('data_inicio') as string)?.trim() || null
  const dataPrevisao    = (formData.get('data_previsao_termino') as string)?.trim() || null
  const valorRaw        = (formData.get('valor_contrato') as string)?.replace(/\./g, '').replace(',', '.').trim()
  const valorNum        = valorRaw ? parseFloat(valorRaw) : null
  const valorContrato   = valorNum != null && !Number.isNaN(valorNum) ? valorNum : null

  const { data, error } = await supabase
    .from('obras')
    .insert({
      empresa_id:            empresaId,
      nome,
      tipo,
      cliente_id:            clienteId || null,
      responsavel_id:        responsavelId || null,
      endereco,
      cidade,
      estado,
      art_numero:            artNumero,
      descricao,
      status,
      data_inicio:           dataInicio || null,
      data_previsao_termino: dataPrevisao || null,
      valor_contrato:        valorContrato,
      created_by:            user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/obras')
  return { id: data.id }
}
