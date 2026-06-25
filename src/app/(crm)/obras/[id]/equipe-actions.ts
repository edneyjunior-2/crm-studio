'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'

export async function adicionarColaboradorObra(
  obraId: string,
  colaboradorId: string,
  funcao?: string | null,
  dataInicio?: string | null,
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }
  if (!obraId || !colaboradorId) return { error: 'Dados obrigatórios.' }

  const { data: obra } = await supabase
    .from('obras')
    .select('id')
    .eq('id', obraId)
    .single()

  if (!obra) return { error: 'Obra não encontrada.' }

  const { error } = await supabase.from('obras_colaboradores').insert({
    obra_id: obraId,
    colaborador_id: colaboradorId,
    funcao: funcao?.trim() || null,
    data_inicio: dataInicio || null,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Colaborador já está designado para esta obra.' }
    return { error: error.message }
  }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function removerColaboradorObra(
  obraColaboradorId: string,
  obraId: string,
): Promise<{ error?: string }> {
  // Usa getAuthUser (RLS ativo): delete_admin policy verifica role='admin' do usuário
  const { supabase } = await getAuthUser()

  const { error } = await supabase
    .from('obras_colaboradores')
    .delete()
    .eq('id', obraColaboradorId)
    .eq('obra_id', obraId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}
