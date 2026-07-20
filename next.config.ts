import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react', '@base-ui/react'],
    // 4.5mb é o teto REAL da Vercel pra corpo de Server Action (Hobby/Pro, não
    // configurável) — declarar aqui só deixa explícito o limite da plataforma,
    // não aumenta nada além dele. Usado pelo envio de mídia no Atendimento
    // (avatar/timbrado continuam bem abaixo disso).
    serverActions: { bodySizeLimit: '4.5mb' },
  },
  async headers() {
    // CSP em modo REPORT-ONLY: não bloqueia nada ainda — só reporta violações no
    // console do navegador. Política-alvo realista (o client só fala com self +
    // Supabase: API/storage/auth + realtime via wss). 'unsafe-inline'/'unsafe-eval'
    // em script-src porque o Next/React injetam bootstrap inline; a proteção vem de
    // não permitir origens de script externas, object-src 'none', base-uri 'self' e
    // o allowlist de connect-src (barra exfiltração p/ domínio do atacante).
    // VALIDAR no console e, sem violações legítimas, trocar o header para
    // 'Content-Security-Policy' (enforce).
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      // lookerstudio/datastudio.google.com: embed do painel de Ads em /admin/ads
      // (platform-admin). Os dois domínios servem o mesmo relatório (datastudio
      // redireciona pra lookerstudio) — libero ambos pra o iframe não bloquear.
      "frame-src 'self' https://lookerstudio.google.com https://datastudio.google.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; ')

    // Headers de segurança aplicados a todas as rotas (exceto X-Frame-Options, tratado abaixo).
    const baseSecurity = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Content-Security-Policy-Report-Only', value: csp },
    ]
    return [
      { source: '/(.*)', headers: baseSecurity },
      // Gerador de contratos roda dentro de um iframe same-origin → SAMEORIGIN (não DENY).
      // Cobre a página (/contratos/*) e o proxy que serve o template (/api/contratos/*).
      {
        source: '/contratos/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/contratos/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      // Todo o resto: bloqueia enquadramento por completo (anti-clickjacking).
      {
        source: '/((?!contratos|api/contratos).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
    ]
  },
}

export default nextConfig
