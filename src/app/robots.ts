import type { MetadataRoute } from 'next'

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.crmstudio.com.br'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Áreas privadas/autenticadas e APIs não devem ser indexadas.
      disallow: [
        '/admin',
        '/api',
        '/dashboard',
        '/configuracoes',
        '/selecionar-empresa',
        '/login',
      ],
    },
    host: base,
    sitemap: `${base}/sitemap.xml`,
  }
}
