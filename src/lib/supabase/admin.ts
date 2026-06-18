import { createClient } from '@supabase/supabase-js'
import https from 'node:https'
import { URL as NodeURL } from 'node:url'
import type { IncomingMessage } from 'node:http'

// O Next.js 16 patcha globalThis.fetch e pode injetar headers da requisição
// de entrada (cookies, etc.) em fetch() feito pelo servidor. Se esses headers
// tiverem chars > 255 (ex: em dash em nome do usuário armazenado em cookie),
// o undici joga erro ByteString. Usando node:https diretamente contornamos isso.
function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : (input as Request).url

  const method = (init?.method ?? 'GET').toUpperCase()
  const bodyStr =
    init?.body == null
      ? undefined
      : typeof init.body === 'string'
      ? init.body
      : JSON.stringify(init.body)

  // Apenas os headers que o Supabase passa — sem herdar nada do Next.js
  const rawHeaders = (init?.headers ?? {}) as Record<string, string>
  const safeHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawHeaders)) {
    safeHeaders[k] = typeof v === 'string' ? v.replace(/[^\x00-\xFF]/g, '') : v
  }
  if (bodyStr) {
    safeHeaders['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8').toString()
  }

  const parsed = new NodeURL(url)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: parsed.hostname,
        port:     parsed.port || 443,
        path:     parsed.pathname + parsed.search,
        headers:  safeHeaders,
      },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          // Converte os headers do IncomingMessage para Headers do Fetch
          const headers = new Headers()
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
          }
          resolve(new Response(body, { status: res.statusCode ?? 200, headers }))
        })
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: { fetch: adminFetch },
      auth:   { autoRefreshToken: false, persistSession: false },
    }
  )
}
