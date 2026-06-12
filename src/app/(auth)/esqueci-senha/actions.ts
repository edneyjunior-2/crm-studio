'use server'

import { createClient } from '@/lib/supabase/server'

export async function enviarRecuperacaoSenha(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const email = formData.get('email') as string
  if (!email) return { error: 'E-mail é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crm.aurumtax.com.br'}/reset-password`,
  })

  if (error) return { error: 'Erro ao enviar e-mail. Tente novamente.' }
  return { success: true }
}
