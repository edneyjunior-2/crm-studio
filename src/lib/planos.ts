/**
 * planos.ts — Catálogo de planos vendáveis (fonte única de preço e rótulo)
 *
 * Nasce da spec .claude/specs/planos-verticais-no-checkout.md: antes desta
 * mudança o preço cobrado no checkout (src/lib/asaas.ts) e no webhook
 * (src/app/api/asaas/webhook/route.ts) estava cravado em 147 (Starter),
 * divergindo do que o /precos anuncia para os outros planos/verticais.
 *
 * Preço NUNCA em SQL (evita divergir do TS) — este arquivo é a ÚNICA fonte de
 * preço/rótulo consumida por precos/page.tsx, cadastro-form.tsx,
 * cadastro/pagamento/actions.ts, cadastro/pagamento/page.tsx, asaas.ts e o
 * webhook.
 */

export const PLANOS_VENDAVEIS = ['starter', 'pro', 'business', 'advocacia', 'engenharia'] as const

export type PlanoVendavel = (typeof PLANOS_VENDAVEIS)[number]

/** Preço mensal em reais — deve bater EXATAMENTE com o que /precos exibe. */
export const PRECO_POR_PLANO: Record<PlanoVendavel, number> = {
  starter:    147,
  pro:        297,
  business:   497,
  advocacia:  247,
  engenharia: 347,
}

export const PLANO_LABEL: Record<PlanoVendavel, string> = {
  starter:    'Starter',
  pro:        'Pro',
  business:   'Business',
  advocacia:  'Advocacia',
  engenharia: 'Engenharia e Obras',
}

/** Preço formatado em BRL — use sempre isto para EXIBIR preço, nunca string crua. */
export function precoFormatado(plano: PlanoVendavel): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(PRECO_POR_PLANO[plano])
}

/** Frase curta (1 linha) usada no seletor de /cadastro. */
export const PLANO_TAGLINE: Record<PlanoVendavel, string> = {
  starter:    'Para o time pequeno organizar o funil.',
  pro:        'O comercial inteiro, com financeiro nativo.',
  business:   'Operação completa, sem escolher módulo.',
  advocacia:  'CRM + Processos jurídicos com DataJud e DJEN.',
  engenharia: 'CRM + Obras, estoque e materiais.',
}

/** Quando ?plano= não vem na URL (CTA do hero, sem contexto de card). */
export const PLANO_DEFAULT: PlanoVendavel = 'pro'

/**
 * Valida um valor vindo de query string / FormData (entrada do usuário).
 * Devolve PLANO_DEFAULT se ausente/inválido — nunca lança, nunca deixa o
 * cliente escolher um slug fora da whitelist.
 */
export function planoValido(v: unknown): PlanoVendavel {
  return typeof v === 'string' && (PLANOS_VENDAVEIS as readonly string[]).includes(v)
    ? (v as PlanoVendavel)
    : PLANO_DEFAULT
}
