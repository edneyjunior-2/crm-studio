import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Rate-limit de janela fixa via Postgres (RPC `check_rate_limit`).
 * Retorna `true` se a requisição está DENTRO do limite; `false` se excedeu.
 *
 * Fail-open: se o banco falhar, permite a requisição (não derruba um fluxo
 * legítimo por causa de erro de infra). O custo de abrir nesse caso raro é
 * menor que bloquear cadastro/contato real.
 *
 * ponytail: janela fixa simples (não sliding window). Suficiente contra
 * spam/brute-force de formulário; trocar por sliding window só se o abuso na
 * borda da janela virar problema real.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    if (error) {
      console.error('[rate-limit] RPC falhou:', error.message)
      return true // fail-open
    }
    return data === true
  } catch (e) {
    console.error('[rate-limit] exceção:', e)
    return true // fail-open
  }
}

/** Extrai o IP do cliente dos headers (Vercel popula x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
