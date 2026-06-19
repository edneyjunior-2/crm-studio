import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Autenticação de integrações externas (ex.: SDR) via API key.
 *
 * O admin gera a chave em /admin/empresas/[id] (gerarApiKey): um token de 32
 * bytes hex cujo sha256 é guardado em `api_keys.key_hash`. Aqui recebemos o
 * token no header Authorization: Bearer, calculamos o sha256 e procuramos a
 * linha — a `empresa_id` da chave é a ÚNICA fonte de verdade do tenant
 * (nunca confiar em empresa_id vindo do corpo da requisição).
 */
export async function verificarApiKey(
  authHeader: string | null,
): Promise<{ empresaId: string } | null> {
  if (!authHeader) return null
  const m = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  // normaliza p/ minúsculo — o token é gerado como hex lowercase; evita falha de
  // lookup por diferença de caixa e torna o hash determinístico.
  const token = m[1].trim().toLowerCase()
  // tokens válidos têm 64 hex chars (32 bytes). Evita lookups inúteis.
  if (!/^[a-f0-9]{64}$/.test(token)) return null

  const keyHash = createHash('sha256').update(token).digest('hex')

  const db = createAdminClient()
  const { data, error } = await db
    .from('api_keys')
    .select('empresa_id')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error || !data?.empresa_id) return null
  return { empresaId: data.empresa_id }
}
