'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReatribuicaoEmail } from '@/lib/email'

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
    .select('id, numero_processo, assunto')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Processo não encontrado ou sem permissão.' }

  revalidatePath('/processos/responsabilidades')
  revalidatePath(`/processos/${processoId}`)

  // Notificar o novo responsável por e-mail (não bloqueia a resposta se falhar)
  if (novoAdvogadoId) {
    const processo = data[0] as { id: string; numero_processo: string; assunto: string | null }
    try {
      const admin = createAdminClient()
      const [{ data: authUser }, { data: advPerfil }] = await Promise.all([
        admin.auth.admin.getUserById(novoAdvogadoId),
        supabase.from('profiles').select('full_name').eq('id', novoAdvogadoId).single(),
      ])
      const email = authUser?.user?.email
      if (email) {
        await sendReatribuicaoEmail({
          to:             email,
          nomeAdvogado:   advPerfil?.full_name ?? email.split('@')[0],
          numeroProcesso: processo.numero_processo,
          assunto:        processo.assunto ?? null,
          processoId,
        })
      }
    } catch {
      // Falha de e-mail não cancela a reatribuição
    }
  }

  return {}
}
