import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/google/calendar'
import { randomBytes } from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const state = randomBytes(32).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutos
    path: '/',
  })

  const url = getAuthUrl(state)
  return NextResponse.json({ url })
}
