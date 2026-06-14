import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=Erro+ao+autenticar+com+Google', url.origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(new URL('/login?error=Erro+ao+autenticar+com+Google', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
