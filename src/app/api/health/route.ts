import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type CheckStatus = 'ok' | string

interface HealthResponse {
  status: 'ok' | 'degraded'
  checks: Record<string, CheckStatus>
  timestamp: string
}

export async function GET(request: NextRequest) {
  const token = process.env.HEALTH_CHECK_TOKEN
  const provided = request.headers.get('x-health-token')
  // Timing-safe comparison: rejects immediately if token is unset or lengths differ,
  // otherwise compares constant-time to prevent timing oracle attacks.
  if (!token || !provided) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tokenBuf    = Buffer.from(token,    'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')
  const tokenMatch  = tokenBuf.byteLength === providedBuf.byteLength &&
    timingSafeEqual(tokenBuf, providedBuf)
  if (!tokenMatch) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const tableNames = [
    'clientes',
    'negocios',
    'contas_pagar',
    'parceiros',
    'fluxos',
    'profiles',
  ] as const

  const results = await Promise.all(
    tableNames.map(async (table) => {
      const { error } = await supabase.from(table).select('id').limit(1)
      return { name: table, status: error ? `error: ${error.message}` : 'ok' }
    })
  )

  const checks: Record<string, CheckStatus> = {}
  for (const result of results) {
    checks[result.name] = result.status
  }

  const hasError = results.some((r) => r.status !== 'ok')
  const body: HealthResponse = {
    status: hasError ? 'degraded' : 'ok',
    checks,
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(body, { status: hasError ? 503 : 200 })
}
