// Helper de disparo de eventos do GA4 (Google Analytics 4).
// Client-only: sem gtag disponível (env ausente, script bloqueado, SSR),
// a chamada é um no-op silencioso — nunca quebra a página.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

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

  // Conversão do Google Ads: dispara junto com a conversão principal, gated
  // pela env — sem NEXT_PUBLIC_ADS_CONVERSION configurada, fica só o evento GA4 acima.
  if (name === 'trial_iniciado') {
    const adsConversionId = process.env.NEXT_PUBLIC_ADS_CONVERSION
    if (adsConversionId) {
      window.gtag('event', 'conversion', { send_to: adsConversionId })
    }
  }
}
