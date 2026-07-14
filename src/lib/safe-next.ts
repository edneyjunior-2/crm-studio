/** Sanitiza um destino pós-login (`next`) pra impedir open redirect.
 * Resolve contra `origin` e só aceita quando o resultado fica no mesmo
 * origin — bloqueia `//evil.com`, `https://evil.com` e a variante de barra
 * invertida (`/\evil.com`), que o parser de URL do navegador também resolve
 * pra fora do site (`new URL('/\\evil.com', origin).host === 'evil.com'`).
 * Usada tanto no botão do Google (client) quanto no callback OAuth (server) —
 * mesma regra nos dois lados, sem duplicar a lógica de segurança. */
export function sanitizeNextPath(next: string | null | undefined, origin: string): string {
  const fallback = '/dashboard'
  if (!next) return fallback
  try {
    const resolved = new URL(next, origin)
    if (resolved.origin !== origin) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}
