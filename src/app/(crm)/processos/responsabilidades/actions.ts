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
      // GOTCHA: admin.auth.admin.getUserById() (GoTrue) falha/retorna vazio em
      // prod neste projeto — ler da view profiles_auth (service-role) em vez do GoTrue.
      const [{ data: authRow }, { data: advPerfil }] = await Promise.all([
        admin.from('profiles_auth').select('email').eq('id', novoAdvogadoId).maybeSingle(),
        supabase.from('profiles').select('full_name').eq('id', novoAdvogadoId).single(),
      ])
      const email = authRow?.email
      if (email) {
        const resultado = await sendReatribuicaoEmail({
          to:             email,
          nomeAdvogado:   advPerfil?.full_name ?? email.split('@')[0],
          numeroProcesso: processo.numero_processo,
          assunto:        processo.assunto ?? null,
          processoId,
        })
        if (!resultado.sent) {
          await admin.from('monitoramento_falhas_email').insert({
            tipo: 'reatribuicao_processo',
            referencia_id: processoId,
            destinatario: email,
            erro: resultado.reason ?? 'desconhecido',
          }).then(undefined, () => {})
        }
      }
    } catch (e) {
      // Falha de e-mail não cancela a reatribuição — apenas loga (nada era logado antes)
      console.error('[responsabilidades] falha ao notificar novo responsável por e-mail:', e)
    }
  }

  return {}
}
