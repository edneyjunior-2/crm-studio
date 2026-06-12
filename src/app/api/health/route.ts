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
  if (token) {
    const provided = request.headers.get('x-health-token')
    if (provided !== token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
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
