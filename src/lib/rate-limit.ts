import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Rate-limit de janela fixa via Postgres (RPC `check_rate_limit`).
 * Retorna `true` se a requisição está DENTRO do limite; `false` se excedeu.
 *
 * Por padrão é FAIL-OPEN: se o banco falhar, permite a requisição (não derruba
 * um fluxo legítimo por causa de erro de infra transitório). O custo de abrir
 * nesse caso raro é menor que bloquear um contato real.
 *
 * `failClosed: true` inverte isso — na falha do banco, BLOQUEIA. Use em
 * qualquer fluxo onde este limiter seja a ÚNICA barreira anti-abuso e o custo
 * de abrir seja escrita em massa no banco. Caso concreto: o cadastro
 * (src/app/(marketing)/cadastro/actions.ts) passou a criar usuários pela Admin
 * API do Supabase, o que CONTORNA o rate limit nativo do endpoint público de
 * signup do GoTrue. Sem fail-closed ali, um atacante que satura o Postgres
 * derruba a própria trava que deveria contê-lo (quanto mais martela, maior a
 * chance do RPC falhar e liberar) — e cada criação dispara o trigger
 * handle_new_user, gerando auth.users + empresas + profiles sem limite.
 *
 * ponytail: janela fixa simples (não sliding window). Suficiente contra
 * spam/brute-force de formulário; trocar por sliding window só se o abuso na
 * borda da janela virar problema real.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  opts?: { failClosed?: boolean },
): Promise<boolean> {
  const permitirNaFalha = !opts?.failClosed
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    if (error) {
      console.error('[rate-limit] RPC falhou:', error.message)
      return permitirNaFalha
    }
    return data === true
  } catch (e) {
    console.error('[rate-limit] exceção:', e)
    return permitirNaFalha
  }
}

/** Extrai o IP do cliente dos headers (Vercel popula x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
