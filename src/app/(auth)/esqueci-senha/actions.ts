'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function enviarRecuperacaoSenha(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  // Anti-abuso: 5 e-mails de recuperação/hora por IP
  const ip = clientIp(await headers())
  if (!(await rateLimit(`reset-senha:${ip}`, 5, 3600))) {
    return { error: 'Muitas solicitações. Aguarde alguns minutos e tente novamente.' }
  }

  const email = formData.get('email') as string
  if (!email) return { error: 'E-mail é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/reset-password`,
  })

  if (error) return { error: 'Erro ao enviar e-mail. Tente novamente.' }
  return { success: true }
}
