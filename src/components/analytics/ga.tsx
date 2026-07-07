'use client'

// Injeta o Google Analytics 4 (gtag.js) e observa a rota atual para disparar
// os eventos-chave do funil de marketing (view_pricing, iniciar_cadastro,
// trial_iniciado) — sem precisar tocar no conteúdo das páginas (essa lane não
// mexe em copy/produto/preços). Sem NEXT_PUBLIC_GA_ID configurada, o
// componente não renderiza nada (no-op seguro em dev/preview sem GA).
//
// Montado em dois layouts (docs/lancamento/tracking-plano.md):
//   - src/app/(marketing)/layout.tsx → cobre / , /precos, /cadastro etc.
//   - src/app/(auth)/layout.tsx      → cobre /login, onde cai o redirect de
//     sucesso do cadastro ('/login?cadastro=ok'), fora do layout de marketing.

import Script from 'next/script'
import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

// ID de métricas do fluxo Web (www.crmstudio.com.br). É público (fica visível no
// HTML), então fica cravado como padrão pra funcionar sem depender de env na
// Vercel; NEXT_PUBLIC_GA_ID sobrepõe se precisar trocar de propriedade.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-B9J589682L'

// Evita duplicar a conversão principal se '/login?cadastro=ok' for recarregada
// (F5) na mesma aba/sessão do navegador.
const TRIAL_STARTED_KEY = 'ga_trial_iniciado_disparado'

function readTrialFlag(): boolean {
  try {
    return window.sessionStorage.getItem(TRIAL_STARTED_KEY) === '1'
  } catch {
    return false
  }
}

function writeTrialFlag() {
  try {
    window.sessionStorage.setItem(TRIAL_STARTED_KEY, '1')
  } catch {
    // sessionStorage bloqueado (modo privado etc.) — não quebra o disparo do evento
  }
}

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

    // Conversão principal: sucesso do cadastro cai em /login?cadastro=ok
    // (server action com redirect — ver (marketing)/cadastro/actions.ts).
    if (pathname === '/login' && searchParams.get('cadastro') === 'ok' && !readTrialFlag()) {
      trackEvent('trial_iniciado', { value: 297, currency: 'BRL' })
      writeTrialFlag()
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
        `}
      </Script>
      <Suspense fallback={null}>
        <RouteEvents />
      </Suspense>
    </>
  )
}
