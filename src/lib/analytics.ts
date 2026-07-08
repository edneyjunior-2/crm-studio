// Helper de disparo de eventos do GA4 (Google Analytics 4).
// Client-only: sem gtag disponível (env ausente, script bloqueado, SSR),
// a chamada é um no-op silencioso — nunca quebra a página.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

// Ação de conversão "Trial iniciado" da campanha CRM Studio | Busca | Não-Marca | BR
// (Google Ads, conta 415-374-1078). É pública (fica visível no HTML de qualquer
// site com Ads); fica cravada como default para funcionar sem depender de env na
// Vercel. NEXT_PUBLIC_ADS_CONVERSION sobrepõe se trocar de conta/ação.
const ADS_CONVERSION_ID = process.env.NEXT_PUBLIC_ADS_CONVERSION ?? 'AW-11038250248/4FZPCPGns8wcEIiquY8p'

/**
 * Dispara um evento no GA4 via window.gtag.
 * Eventos-chave do funil de marketing (docs/lancamento/tracking-plano.md):
 *   - 'view_pricing'     → carregou a página de preços
 *   - 'iniciar_cadastro' → carregou a página de cadastro
 *   - 'trial_iniciado'   → conversão principal (cadastro concluído)
 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return

  window.gtag('event', name, params ?? {})

  // Conversão do Google Ads: dispara junto com a conversão principal.
  if (name === 'trial_iniciado') {
    window.gtag('event', 'conversion', { send_to: ADS_CONVERSION_ID })
  }
}

// Dedup da conversão principal — protege contra F5/reentrada na mesma tela
// disparando 'trial_iniciado' mais de uma vez na mesma aba/sessão do navegador.
// Usado por src/app/(marketing)/cadastro/pagamento/sucesso (trial com cartão
// obrigatório — o evento só dispara quando o cartão já foi confirmado, nunca
// no load da página por si só; ver trial-iniciado-tracker.tsx).
const TRIAL_INICIADO_KEY = 'ga_trial_iniciado_disparado'

export function trackTrialIniciadoOnce(params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  try {
    if (window.sessionStorage.getItem(TRIAL_INICIADO_KEY) === '1') return
  } catch {
    // sessionStorage bloqueado (modo privado etc.) — segue e tenta disparar
    // mesmo assim, mesma política fail-open do resto deste arquivo.
  }

  trackEvent('trial_iniciado', params)

  try {
    window.sessionStorage.setItem(TRIAL_INICIADO_KEY, '1')
  } catch {
    // no-op
  }
}
