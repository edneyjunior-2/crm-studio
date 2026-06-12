import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/google/calendar'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Usuário negou o acesso no Google
  if (error) {
    return NextResponse.redirect(
      new URL('/minha-conta?google=denied', request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/minha-conta?google=error', request.url)
    )
  }

  // Verificar autenticação do usuário
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { access_token, refresh_token, expiry_date } = await exchangeCodeForTokens(code)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        google_access_token: access_token,
        google_refresh_token: refresh_token,
        google_token_expiry: new Date(expiry_date).toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.redirect(
        new URL('/minha-conta?google=error', request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/minha-conta?google=connected', request.url)
    )
  } catch {
    return NextResponse.redirect(
      new URL('/minha-conta?google=error', request.url)
    )
  }
}
