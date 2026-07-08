'use client'

// Injeta o Google Analytics 4 (gtag.js) e observa a rota atual para disparar
// os eventos-chave do funil de marketing (view_pricing, iniciar_cadastro) —
// sem precisar tocar no conteúdo das páginas (essa lane não mexe em
// copy/produto/preços). Sem NEXT_PUBLIC_GA_ID configurada, o componente não
// renderiza nada (no-op seguro em dev/preview sem GA).
//
// Montado em dois layouts (docs/lancamento/tracking-plano.md):
//   - src/app/(marketing)/layout.tsx → cobre / , /precos, /cadastro,
//     /cadastro/pagamento, /cadastro/pagamento/sucesso etc.
//   - src/app/(auth)/layout.tsx      → cobre /login.
//
// A conversão 'trial_iniciado' NÃO é disparada por pathname aqui (era o caso
// antigo de '/login?cadastro=ok'). Desde o trial-com-cartão-obrigatório, o
// cadastro só conta como convertido depois que o webhook do Asaas confirma o
// cartão — chegar em /cadastro/pagamento/sucesso não é garantia disso (ver
// invariante de segurança na spec). Por isso o disparo mora na própria página
// de sucesso (trial-iniciado-tracker.tsx), condicionado ao status real da
// empresa, usando trackTrialIniciadoOnce() de src/lib/analytics.ts.

import Script from 'next/script'
import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

// ID de métricas do fluxo Web (www.crmstudio.com.br). É público (fica visível no
// HTML), então fica cravado como padrão pra funcionar sem depender de env na
// Vercel; NEXT_PUBLIC_GA_ID sobrepõe se precisar trocar de propriedade.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-B9J589682L'

// ID base da conta do Google Ads (sem o /label — o label só entra no evento de
// conversão, ver src/lib/analytics.ts). Precisa de um gtag('config', 'AW-...')
// carregado na página para o Google Ads reconhecer a tag e rotear o evento de
// conversão com confiabilidade (sem isso, o Ads mostra "Nenhuma tag encontrada
// para esta conta" e a conversão pode não ser roteada). Deriva do mesmo valor
// usado em analytics.ts para não duplicar a fonte da verdade.
const ADS_ID = (process.env.NEXT_PUBLIC_ADS_CONVERSION ?? 'AW-11038250248/4FZPCPGns8wcEIiquY8p').split('/')[0]

/**
 * Observa pathname + querystring e dispara o evento de negócio certo.
 * Isolado num componente próprio porque useSearchParams exige um boundary de
 * Suspense em rotas estáticas (senão o build de produção falha).
 */
function RouteEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastFiredKey = useRef<string | null>(null)

  useEffect(() => {
    if (!GA_ID) return

    // Evita redisparo se o efeito rodar de novo pra mesma rota (ex.: StrictMode em dev).
    const currentKey = `${pathname}?${searchParams.toString()}`
    if (lastFiredKey.current === currentKey) return
    lastFiredKey.current = currentKey

    if (pathname === '/precos') {
      trackEvent('view_pricing')
    }

    if (pathname === '/cadastro') {
      trackEvent('iniciar_cadastro')
    }
  }, [pathname, searchParams])

  return null
}

export function Ga() {
  if (!GA_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());

          // TODO(LGPD): Consent Mode v2 com defaults negados (analytics_storage,
          // ad_storage etc.) até o aceite num banner de cookies — especificado em
          // docs/lancamento/tracking-plano.md Seção 4. Deixado como TODO pra não
          // travar o lançamento: priorizando o tracking funcionar primeiro.
          gtag('config', '${GA_ID}');
          gtag('config', '${ADS_ID}');
        `}
      </Script>
      <Suspense fallback={null}>
        <RouteEvents />
      </Suspense>
    </>
  )
}
