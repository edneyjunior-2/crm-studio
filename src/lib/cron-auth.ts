import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Verifica o header Authorization de uma rota de cron contra o CRON_SECRET,
 * usando comparação TIMING-SAFE (createHash('sha256') + timingSafeEqual) para
 * não vazar o segredo via timing attack.
 *
 * Aceita tanto um `Request` quanto a string do header Authorization direto.
 * Retorna false se CRON_SECRET não estiver configurado (fail-closed).
 *
 * O sha256 garante buffers de tamanho igual antes do timingSafeEqual
 * (timingSafeEqual lança se os comprimentos diferem).
 */
export function verificarCronSecret(input: Request | string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authHeader =
    typeof input === 'string' || input == null
      ? (input ?? '')
      : (input.headers.get('authorization') ?? '')

  const esperado = createHash('sha256').update(`Bearer ${secret}`).digest()
  const recebido = createHash('sha256').update(authHeader).digest()
  return timingSafeEqual(esperado, recebido)
}
