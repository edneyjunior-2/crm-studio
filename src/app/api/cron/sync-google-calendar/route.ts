import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarCronSecret } from '@/lib/cron-auth'
import { sincronizarCalendarioUsuario } from '@/lib/google/calendar-sync'

export const maxDuration = 300 // 5 min (Vercel Pro)

// Throttle sequencial entre usuários — mesmo padrão dos crons DataJud/DJEN,
// evita disparar tudo de uma vez contra a API do Google.
const THROTTLE_MS = 600
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Vercel Cron invoca via GET; POST permite trigger manual autenticado
export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

async function handler(req: NextRequest) {
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: profiles, error: errProfiles } = await db
    .from('profiles')
    .select('id')
    .not('google_refresh_token', 'is', null)

  if (errProfiles) {
    return NextResponse.json({ error: errProfiles.message }, { status: 500 })
  }

  const alvos = profiles ?? []

  let importados = 0
  let atualizados = 0
  let removidos = 0
  let usuariosProcessados = 0
  const erros: string[] = []

  for (let i = 0; i < alvos.length; i++) {
    if (i > 0) await sleep(THROTTLE_MS)
    const profileId = alvos[i].id as string

    try {
      const res = await sincronizarCalendarioUsuario(profileId)
      if (!res.ok) {
        erros.push(`profile ${profileId}: ${res.erro}`)
        continue
      }
      importados += res.importados
      atualizados += res.atualizados
      removidos += res.removidos
      usuariosProcessados++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`profile ${profileId}: ${msg}`)
    }
  }

  return NextResponse.json({
    usuarios_processados: usuariosProcessados,
    eventos_importados: importados,
    eventos_atualizados: atualizados,
    eventos_removidos: removidos,
    ...(erros.length ? { erros } : {}),
  })
}
