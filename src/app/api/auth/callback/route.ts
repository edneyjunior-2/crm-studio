import { createClient } from '@/lib/supabase/server'
import { sanitizeNextPath } from '@/lib/safe-next'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = sanitizeNextPath(url.searchParams.get('next'), url.origin)

  // O provedor (Supabase/Google) pode voltar com um erro em vez de code — nesse
  // caso o motivo real vem em ?error / ?error_description / ?error_code.
  // Antes engolíamos tudo numa mensagem genérica; agora surfamos o motivo real.
  const provError = url.searchParams.get('error')
  const provErrorDesc = url.searchParams.get('error_description')
  if (provError || provErrorDesc) {
    console.error('[auth/callback] provider error:', {
      error: provError,
      error_code: url.searchParams.get('error_code'),
      error_description: provErrorDesc,
    })
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(provErrorDesc || provError || 'Falha na autenticação')}`, url.origin)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=' + encodeURIComponent('Autenticação sem código — tente novamente.'), url.origin)
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[auth/callback] exchange error:', { message: error?.message, status: error?.status })
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message ?? 'Falha ao concluir a autenticação.')}`, url.origin)
    )
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
