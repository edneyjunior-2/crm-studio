import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 15

type SensorStatus = 'ok' | 'alerta' | 'critico'

interface Sensor {
  chave: string
  nome: string
  area: string
  status: SensorStatus
  detalhe: string
  desde: string | null
  atualizado_em: string
}

interface StatusResponse {
  status: SensorStatus
  sensores: Sensor[]
  atualizado_em: string | null
}

// Pior status vence: 'critico' > 'alerta' > 'ok'
const SEVERIDADE: Record<SensorStatus, number> = { ok: 0, alerta: 1, critico: 2 }

export async function GET(request: NextRequest) {
  const token = process.env.MONITOR_STATUS_TOKEN
  const provided = request.headers.get('x-monitor-token')
  // Timing-safe comparison: rejeita de cara se o token não estiver setado ou os
  // tamanhos diferirem, senão compara em tempo constante (evita timing oracle).
  if (!token || !provided) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tokenBuf = Buffer.from(token, 'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')
  const tokenMatch =
    tokenBuf.byteLength === providedBuf.byteLength && timingSafeEqual(tokenBuf, providedBuf)
  if (!tokenMatch) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('monitoramento_status')
    .select('chave, nome, area, status, detalhe, desde, atualizado_em')
    .order('area')
    .order('nome')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sensores = (data ?? []) as Sensor[]

  if (sensores.length === 0) {
    const body: StatusResponse = { status: 'ok', sensores: [], atualizado_em: null }
    return NextResponse.json(body)
  }

  const status = sensores.reduce<SensorStatus>(
    (pior, s) => (SEVERIDADE[s.status] > SEVERIDADE[pior] ? s.status : pior),
    'ok'
  )

  const atualizadoEm = sensores.reduce<string>(
    (maisRecente, s) =>
      new Date(s.atualizado_em).getTime() > new Date(maisRecente).getTime()
        ? s.atualizado_em
        : maisRecente,
    sensores[0].atualizado_em
  )

  const body: StatusResponse = { status, sensores, atualizado_em: atualizadoEm }
  return NextResponse.json(body)
}
