import { createClient } from '@supabase/supabase-js'

/**
 * Normaliza traços Unicode (en dash, em dash, hífen tipográfico, etc.) de volta
 * para o hífen ASCII (-). Chaves JWT base64url do Supabase usam SOMENTE hífen
 * comum; se um traço Unicode aparece na env var, é corrupção de copy-paste
 * (autocorreção transforma - em — em alguns apps). Sem isso, o undici joga
 * "Cannot convert argument to a ByteString" ao montar o header Authorization.
 */
function sanitizeKey(raw: string): string {
  return raw.replace(/[‐-―−]/g, '-').trim()
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    sanitizeKey(process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
