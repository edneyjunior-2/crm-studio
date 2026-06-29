import type { MetadataRoute } from 'next'

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.crmstudio.com.br'

// Rotas públicas de marketing (grupo (marketing)). Rotas de app
// (admin, dashboard, configurações, etc.) ficam fora do sitemap.
const rotas = [
  '/',
  '/produto',
  '/precos',
  '/contato',
  '/termos',
  '/privacidade',
  '/contrato-operador',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return rotas.map((rota) => ({
    url: rota === '/' ? base : `${base}${rota}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: rota === '/' ? 1 : 0.7,
  }))
}
