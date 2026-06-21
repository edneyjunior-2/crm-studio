'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function reatribuirResponsavel(
  processoId: string,
  novoAdvogadoId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (perfil?.role !== 'admin' && perfil?.role !== 'socio') {
    return { error: 'Apenas administradores e sócios podem reatribuir processos.' }
  }

  const { data, error } = await supabase
    .from('processos_juridicos')
    .update({ advogado_id: novoAdvogadoId })
    .eq('id', processoId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Processo não encontrado ou sem permissão.' }

  revalidatePath('/processos/responsabilidades')
  revalidatePath(`/processos/${processoId}`)
  return {}
}
