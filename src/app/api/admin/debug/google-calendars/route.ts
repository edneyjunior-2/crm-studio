import { NextRequest, NextResponse } from 'next/server'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { listGoogleCalendars } from '@/lib/google/calendar'

/**
 * Diagnóstico read-only (platform-admin only): lista TODOS os calendários do
 * Google que um usuário tem acesso, não só o 'primary' sincronizado hoje.
 * Criado pra investigar o chamado #36 ("minha agenda não está aparecendo
 * completa") — confirma se o compromisso do usuário vive num calendário
 * secundário/compartilhado que a sincronização atual nunca alcança.
 * Nada é gravado nem alterado — só leitura contra a API do Google.
 */
export async function GET(req: NextRequest) {
  await getAuthPlatformAdmin()

  const profileId = req.nextUrl.searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'profileId é obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, full_name, google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', profileId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!profile?.google_refresh_token) {
    return NextResponse.json({ error: 'Perfil sem Google Calendar conectado.' }, { status: 404 })
  }

  const resultado = await listGoogleCalendars({
    userId: profile.id,
    accessToken: profile.google_access_token ?? '',
    refreshToken: profile.google_refresh_token,
    tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
  })

  return NextResponse.json({ full_name: profile.full_name, ...resultado })
}
