import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react', '@base-ui/react'],
  },
  async headers() {
    // Headers de segurança aplicados a todas as rotas (exceto X-Frame-Options, tratado abaixo).
    const baseSecurity = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    ]
    return [
      { source: '/(.*)', headers: baseSecurity },
      // Gerador de contratos roda dentro de um iframe same-origin → SAMEORIGIN (não DENY).
      {
        source: '/contratos/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      // Todo o resto: bloqueia enquadramento por completo (anti-clickjacking).
      {
        source: '/((?!contratos).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
    ]
  },
}

export default nextConfig
