# Plano de Rastreamento — CRM Studio

> Status: **plano, não implementado.** Este documento lista os pontos exatos de código.
> Nada abaixo altera o app até você executar o passo a passo do final.
> Stack: Next.js 16 (App Router) + React 19. Site em `src/app/(marketing)/`.
> Objetivo de conversão a otimizar: **trial iniciado / cadastro concluído**.

> **Atualização (2026-07, spec `trial-com-cartao.md`):** o cadastro passou a
> exigir cartão de crédito (Checkout hospedado do Asaas) antes de liberar o
> trial. O redirect de sucesso do cadastro **não é mais** `/login?cadastro=ok`
> — agora é `/cadastro/pagamento` (confirmação do cartão) e, depois do
> checkout, `/cadastro/pagamento/sucesso`. O evento `trial_iniciado` também
> mudou de lugar/critério: não dispara mais automaticamente por pathname no
> `<Ga/>` (`src/components/analytics/ga.tsx`) — dispara dentro da própria
> página `/cadastro/pagamento/sucesso`
> (`trial-iniciado-tracker.tsx`), e só quando o status da empresa já deixou de
> ser `pendente_cartao` (ou seja, só depois que o webhook do Asaas confirmar o
> cartão via `SUBSCRIPTION_CREATED`). Isso evita contar a conversão antes do
> cartão estar de fato confirmado — o texto abaixo (Seções 0–7) descreve o
> desenho ORIGINAL, anterior a essa mudança, e fica como histórico.

---

## 0. Situação atual (auditada no código)

- **Não existe** GA4, GTM, `gtag`, `dataLayer` nem `next/script` no projeto (grep vazio em `src/`).
- Fluxo de cadastro:
  - Página: `src/app/(marketing)/cadastro/page.tsx` → renderiza `CadastroForm`.
  - Form (client): `src/components/marketing/cadastro-form.tsx` — submit em `handleSubmit` → `startTransition` → chama a server action `cadastrar`.
  - Server action: `src/app/(marketing)/cadastro/actions.ts` — no sucesso faz `redirect('/login?cadastro=ok')` (linha 159).
- **Detalhe crítico de arquitetura:** o sucesso do cadastro cai em `/login?cadastro=ok`, que está sob **`src/app/(auth)/layout.tsx`**, e NÃO sob o layout de marketing. Ou seja: se o GA for instalado só no layout de marketing, o evento de conversão disparado na tela de sucesso **não terá o GA carregado**. Ver a decisão na Seção 2 (evento `cadastro_concluido`).
- CTAs "Começar grátis":
  - `src/components/marketing/hero.tsx` (linha ~74) → `/cadastro`
  - `src/app/(marketing)/precos/page.tsx` (array `PLANOS`, `href`) → `/cadastro`
  - `src/components/marketing/final-cta.tsx` (linha ~50) → `/cadastro`
  - `src/components/marketing/site-header.tsx` (linhas 57-62 e 90-96) → aponta para **`/login`** (inconsistência: o botão do header manda pra login, não pro cadastro). Recomenda-se padronizar para `/cadastro` antes de medir, senão o funil do header fica poluído.

---

## 1. Instalação do GA4 no Next 16 (App Router)

### 1.1. Variável de ambiente

Adicionar em `.env.local` (e nas envs da Vercel — Production/Preview):

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

Documentar também em `.env.local.example`. Como é `NEXT_PUBLIC_`, é exposta ao browser (correto para GA). Se a env estiver ausente, o componente não renderiza nada (fail-safe — em dev/preview sem ID o GA fica desligado).

### 1.2. Componente do GA (client) — **novo arquivo**

Criar `src/components/marketing/analytics.tsx` (snippet completo na Seção 5). Ele:
- lê `process.env.NEXT_PUBLIC_GA_ID`;
- injeta os dois `<Script>` do gtag via `next/script` com `strategy="afterInteractive"`;
- inicializa o **Consent Mode** com defaults negados ANTES do config (ver Seção 4);
- desabilita o page_view automático do gtag e dispara `page_view` manualmente a cada troca de rota (necessário no App Router — SPA não recarrega a página).

### 1.3. Onde montar (só rotas públicas)

**Não** colocar no root `src/app/layout.tsx` — isso mediria também o app autenticado `(crm)`, que não queremos rastrear com GA de marketing.

Montar o `<Analytics />`:

1. **`src/app/(marketing)/layout.tsx`** — envolve todo o site público. Ponto exato:

   ```tsx
   import { Analytics } from '@/components/marketing/analytics'
   // ...
   return (
     <div className="flex min-h-screen flex-col bg-background text-foreground">
       <Analytics />           {/* <-- adicionar */}
       <SiteHeader />
       <main className="flex-1 overflow-x-clip">{children}</main>
       <SiteFooter />
     </div>
   )
   ```

2. **`src/app/(auth)/layout.tsx`** — hoje é só `<>{children}</>`. Precisa do `<Analytics />` também, porque a tela de sucesso do cadastro (`/login?cadastro=ok`) vive aqui. Sem isso, a conversão principal não dispara. Alternativa mais limpa na Seção 2.2.

> **PPR / Cache Components:** `<Analytics />` é client component com `next/script`; mantê-lo fora de qualquer boundary `'use cache'`. Como está direto no layout, é renderizado no shell dinâmico — ok.

---

## 2. Eventos-chave (o tracking plan)

Convenção: `snake_case`, nomes de negócio em PT-BR onde já combinado, mais parâmetros padrão do GA4 quando fizer sentido (`value`, `currency`).

| Evento | Quando dispara | Onde no código | Parâmetros |
|---|---|---|---|
| `page_view` | toda navegação | `analytics.tsx` (automático via rota) | `page_path`, `page_location` |
| `view_pricing` | página de preços carrega | `src/app/(marketing)/precos/page.tsx` (via um pequeno client wrapper — ver 2.1) | `{}` |
| `iniciar_cadastro` | clique em qualquer "Começar grátis" **ou** load de `/cadastro` | ver 2.2 | `{ origem: 'hero' | 'precos' | 'header' | 'final_cta' }` |
| `trial_iniciado` / `cadastro_concluido` | cadastro criado com sucesso (é a MESMA conversão — usar 1 evento canônico) | ver 2.3 | `{ value, currency:'BRL', tipo_pessoa, plano? }` |
| `assinatura` | quando o trial vira pagante (Asaas) | fora do escopo do site; ver 2.4 | `{ value, currency:'BRL', plano }` |

**Decisão de nomenclatura:** escolher **UM** nome canônico para a conversão de trial e usar em todo lugar. Recomendo `trial_iniciado` como nome do evento e tratar "cadastro_concluido" como sinônimo/rótulo no GA. Misturar os dois nomes duplica a conversão. O restante deste doc usa `trial_iniciado`.

### 2.1. `view_pricing`

`precos/page.tsx` é um Server Component (tem `export const metadata`). Para disparar um evento no client, criar um mini componente:

`src/components/marketing/track-view.tsx` (client):

```tsx
'use client'
import { useEffect } from 'react'
import { track } from '@/lib/analytics'   // helper da Seção 5.2

export function TrackView({ event, params }: { event: string; params?: Record<string, unknown> }) {
  useEffect(() => { track(event, params) }, [event, params])
  return null
}
```

Uso em `precos/page.tsx` (dentro do JSX retornado, no topo):

```tsx
import { TrackView } from '@/components/marketing/track-view'
// ...
return (
  <>
    <TrackView event="view_pricing" />
    {/* ...resto da página... */}
  </>
)
```

### 2.2. `iniciar_cadastro`

Duas formas (escolher uma; recomendo **B** por ser mais robusta):

**A) No clique dos CTAs.** Trocar os `<Link href="/cadastro">` por um wrapper que chama `track('iniciar_cadastro', { origem })` no `onClick`. Locais: `hero.tsx`, `final-cta.tsx`, `precos/page.tsx` (esse é server — precisaria de client wrapper), `site-header.tsx`. Mais verboso e fácil de esquecer um CTA.

**B) No load de `/cadastro`** (recomendado). Um único ponto, pega 100% de quem chega na tela de cadastro (inclusive tráfego direto/anúncio). Em `src/app/(marketing)/cadastro/page.tsx`:

```tsx
import { TrackView } from '@/components/marketing/track-view'
// ...dentro do return, como primeiro filho:
<TrackView event="iniciar_cadastro" />
```

A `origem` pode vir de um `?origem=` na URL dos CTAs (ex.: `/cadastro?origem=precos`) lido via `searchParams` e repassado ao `TrackView`. Se não quiser mexer nos CTAs agora, dispara sem `origem`.

### 2.3. `trial_iniciado` (conversão principal) — ponto exato

O sucesso hoje é um `redirect('/login?cadastro=ok')` DENTRO da server action (`actions.ts` linha 159). Server actions não conseguem disparar gtag (rodam no servidor), e o `redirect()` interrompe o `startTransition` do form — então **não dá pra disparar no `handleSubmit` após o `cadastrar()`** de forma confiável. A conversão precisa disparar no **client, na tela de destino**.

**Opção recomendada — página de sucesso própria (mais limpa para Google Ads):**

1. Criar rota de marketing `src/app/(marketing)/cadastro/sucesso/page.tsx` (fica sob o layout de marketing, que já terá o GA).
2. Mudar o redirect em `actions.ts` (linha 159) de `redirect('/login?cadastro=ok')` para `redirect('/cadastro/sucesso')`.
3. Nessa página, um `<TrackView event="trial_iniciado" params={{ value: 297, currency: 'BRL' }} />` dispara a conversão no load, e a página mostra "Conta criada! Verifique seu e-mail / faça login", com botão para `/login`.
   - Vantagem: URL de destino limpa (`/cadastro/sucesso`) que o Google Ads pode usar como **conversão por URL de destino** sem depender de evento, e mantém o GA 100% dentro do marketing (não precisa tocar no `(auth)/layout.tsx`).

**Opção alternativa — manter `/login?cadastro=ok`:**

1. Montar `<Analytics />` também em `src/app/(auth)/layout.tsx` (Seção 1.3, item 2).
2. Criar um client component que lê `searchParams.cadastro === 'ok'` e dispara `trial_iniciado` uma vez. Cuidado com duplicidade se o usuário recarregar `/login?cadastro=ok` — mitigar com um flag em `sessionStorage`.
   - Desvantagem: acopla GA à área de auth e o parâmetro persiste no reload.

> **Valor da conversão:** mesmo no trial (ainda não paga), atribuir um `value` estimado ajuda o Google Ads a otimizar por ROAS. Sugestão: usar o **ticket médio esperado** (ex.: R$ 297 = Pro) ou o **LTV descontado pela taxa de conversão trial→pago**. Ver Seção 3.3.

### 2.4. `assinatura` (trial → pagante)

Acontece no backend quando o Asaas confirma pagamento (fora do site de marketing). Duas formas:
- **Server-side (recomendado):** GA4 **Measurement Protocol** a partir do webhook do Asaas, enviando `assinatura` com `value` = valor real do plano e `currency: 'BRL'`, usando o `client_id`/`session_id` capturado no cadastro (guardar o `_ga` cookie ou o `client_id` no signup para casar a atribuição). Requer `api_secret` do GA4.
- **Client-side:** só se houver uma tela de "assinatura confirmada" no app — menos confiável.

Isto é fase 2; o essencial para o lançamento é `trial_iniciado`.

---

## 3. Conversão no Google Ads

### 3.1. Caminho recomendado — importar do GA4 (mais simples)

1. Vincular a propriedade GA4 à conta Google Ads (Admin do GA4 → Product Links → Google Ads).
2. No GA4, marcar `trial_iniciado` como **evento-chave** (Admin → Events → toggle "Mark as key event").
3. No Google Ads → Conversões → importar → escolher o evento-chave `trial_iniciado`.
4. Definir a categoria da conversão como "Cadastro/Lead" e a janela de conversão.

Vantagem: um único ponto de instrumentação (o GA4), sem tag extra. Desvantagem: latência de importação (algumas horas) e depende do vínculo GA4↔Ads.

### 3.2. Caminho alternativo — tag AW- de conversão direta

Para otimização em tempo real (Smart Bidding reage mais rápido), disparar também a tag de conversão do Ads no MESMO ponto do `trial_iniciado`:

```js
gtag('event', 'conversion', {
  send_to: 'AW-XXXXXXXXX/AbC-D_efG-h',   // ID da conversão + label do Ads
  value: 297,
  currency: 'BRL',
  transaction_id: '',                     // opcional: id único do cadastro p/ dedupe
})
```

Isso vai no mesmo `TrackView`/página de sucesso da Seção 2.3. Adicionar o config do Ads no `analytics.tsx`:

```js
gtag('config', 'AW-XXXXXXXXX')
```

Dá pra usar **GA4 importado E** a tag AW- ao mesmo tempo, desde que sejam **conversões separadas** no Ads (não conte a mesma ação duas vezes na mesma coluna de "Conversões"). Prática comum: manter só uma na coluna principal.

### 3.3. Valor para ROAS (mesmo estimado)

- Passar `value` + `currency: 'BRL'` no evento de conversão. Sem `value`, o Ads não consegue otimizar por ROAS (só por CPA).
- Como o trial ainda não paga, usar valor **estimado**. Opções, em ordem de preferência:
  1. `value = ticket_médio_do_plano_provável` (ex.: R$ 297).
  2. `value = ticket × taxa_histórica_trial→pago` (ex.: R$ 297 × 0,3 = R$ 89) — mais fiel ao valor esperado.
  3. Valor fixo simbólico (ex.: R$ 100) só para ligar a otimização por valor.
- Quando o `assinatura` real existir (2.4), migrar para **conversões com valor real** e deixar o `trial_iniciado` como conversão secundária (não otimizada por valor) — assim o Ads aprende com receita de verdade.

---

## 4. LGPD / Consentimento (Consent Mode básico)

O site é BR; a LGPD exige base legal e, para cookies de analytics/marketing, o padrão de mercado é **consentimento**. Implementar **Google Consent Mode v2** em modo básico:

1. **Defaults negados** ANTES de qualquer `config`, no `analytics.tsx`:

   ```js
   gtag('consent', 'default', {
     ad_storage: 'denied',
     ad_user_data: 'denied',
     ad_personalization: 'denied',
     analytics_storage: 'denied',
     wait_for_update: 500,
   })
   ```

2. **Banner de consentimento** (a construir — pode ser um client component simples com um cookie `consent`): ao "Aceitar", chamar:

   ```js
   gtag('consent', 'update', {
     ad_storage: 'granted',
     ad_user_data: 'granted',
     ad_personalization: 'granted',
     analytics_storage: 'granted',
   })
   ```

   Persistir a escolha (cookie 6-12 meses) e reaplicar o `update` no load das próximas visitas.

3. Com Consent Mode, o gtag ainda envia **pings sem cookies** (modeling) quando negado — mantém alguma medição sem violar consentimento.
4. Atualizar `/privacidade` e `/termos` (já existem em `src/app/(marketing)/`) citando GA4/Google Ads, finalidade e base legal. O checkbox de aceite do cadastro (`cadastro-form.tsx`, `aceite_termo`) cobre Termos/DPA, mas **não** substitui o consentimento de cookies — são coisas distintas.
5. IP anonimização: o GA4 já não registra IP completo por padrão (ok para LGPD).

> Nível de esforço: o banner é o único componente novo relevante. Para o lançamento, é aceitável subir o GA com Consent Mode em defaults negados + banner mínimo. Sem banner, você estaria coletando analytics sem consentimento — evitar.

---

## 5. Snippets de exemplo (genéricos, prontos para adaptar)

### 5.1. `src/components/marketing/analytics.tsx`

```tsx
'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
// const AW_ID = process.env.NEXT_PUBLIC_ADS_ID  // opcional (AW-XXXXXXXXX)

export function Analytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // page_view manual a cada troca de rota (App Router não recarrega a página)
  useEffect(() => {
    if (!GA_ID || typeof window.gtag !== 'function') return
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '')
    window.gtag('event', 'page_view', {
      page_path: url,
      page_location: window.location.href,
    })
  }, [pathname, searchParams])

  if (!GA_ID) return null // sem env, não carrega nada (dev/preview safe)

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

          // Consent Mode v2 — defaults negados (LGPD)
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });

          // send_page_view: false — a gente controla via useEffect acima
          gtag('config', '${GA_ID}', { send_page_view: false });
          // gtag('config', 'AW-XXXXXXXXX');  // habilitar p/ tag de conversão do Ads
        `}
      </Script>
    </>
  )
}
```

> Como `useSearchParams` é usado, envolver `<Analytics />` num `<Suspense>` no layout (Next 16 exige) ou confiar no boundary do layout. Se der erro de "missing suspense boundary", envolver: `<Suspense fallback={null}><Analytics /></Suspense>`.

### 5.2. Helper de disparo — `src/lib/analytics.ts`

```ts
// Tipagem global do gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

export function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', event, params ?? {})
}

// Conversão do Google Ads (opcional, além do GA4)
export function trackAdsConversion(value = 297) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', 'conversion', {
    send_to: 'AW-XXXXXXXXX/AbC-D_efG-h', // ID/label da conversão do Ads
    value,
    currency: 'BRL',
  })
}
```

### 5.3. Disparo do evento de conversão na tela de sucesso

`src/app/(marketing)/cadastro/sucesso/page.tsx`:

```tsx
import Link from 'next/link'
import { TrackView } from '@/components/marketing/track-view'

export const metadata = { title: 'Conta criada — CRM Studio' }

export default function CadastroSucessoPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      {/* dispara GA4 'trial_iniciado' no load; adicionar Ads via trackAdsConversion se usar tag AW- */}
      <TrackView event="trial_iniciado" params={{ value: 297, currency: 'BRL' }} />
      <h1 className="text-2xl font-bold">Conta criada com sucesso 🎉</h1>
      <p className="mt-3 text-muted-foreground">
        Enviamos um e-mail de boas-vindas. Faça login para começar seus 14 dias grátis.
      </p>
      <Link href="/login" className="mt-6 inline-block rounded-full bg-foreground px-6 py-3 font-semibold text-background">
        Entrar
      </Link>
    </div>
  )
}
```

E em `src/app/(marketing)/cadastro/actions.ts` linha 159, trocar:

```ts
redirect('/login?cadastro=ok')     // antes
redirect('/cadastro/sucesso')      // depois
```

---

## 6. Passo a passo "pronto pra ativar"

1. **Criar propriedade GA4** e pegar o `G-XXXXXXXXXX`.
2. **Adicionar env** `NEXT_PUBLIC_GA_ID` em `.env.local`, `.env.local.example` e nas envs da Vercel (Production + Preview).
3. **Criar** `src/components/marketing/analytics.tsx` (Seção 5.1) e `src/lib/analytics.ts` (Seção 5.2).
4. **Criar** `src/components/marketing/track-view.tsx` (Seção 2.1).
5. **Montar** `<Analytics />` em `src/app/(marketing)/layout.tsx` (dentro de `<Suspense>` se necessário).
6. **Instrumentar eventos:**
   - `view_pricing` → `TrackView` no topo de `precos/page.tsx`.
   - `iniciar_cadastro` → `TrackView` no topo de `cadastro/page.tsx`.
   - `trial_iniciado` → criar `cadastro/sucesso/page.tsx` + trocar o redirect em `actions.ts` (linha 159).
7. **Padronizar CTAs** do header (`site-header.tsx`) de `/login` para `/cadastro` para o funil bater.
8. **Consent Mode:** já vem nos defaults negados do snippet; construir o **banner de consentimento** que chama `gtag('consent','update',…)` e persiste em cookie. Atualizar `/privacidade` e `/termos`.
9. **Verificar disparo:** GA4 DebugView (com a extensão Google Analytics Debugger ou `?debug_mode=1`) — confirmar `page_view`, `view_pricing`, `iniciar_cadastro`, `trial_iniciado`.
10. **Marcar `trial_iniciado` como evento-chave** no GA4.
11. **Google Ads:** vincular GA4 e importar a conversão (Seção 3.1) OU adicionar a tag AW- no `analytics.tsx` + disparo em `trackAdsConversion` (3.2). Definir `value`/`currency` (3.3).
12. **Validar ponta a ponta:** fazer um cadastro de teste, confirmar a conversão no GA4 (Realtime) e, em ~24h, no Google Ads.

---

## 7. Riscos / gotchas registrados

- **GA fora do marketing:** a tela de sucesso original (`/login?cadastro=ok`) está sob `(auth)`, sem GA. A rota `/cadastro/sucesso` (Seção 2.3) resolve isso sem acoplar GA à auth. Se optar por manter `/login?cadastro=ok`, é obrigatório montar `<Analytics />` no `(auth)/layout.tsx`.
- **`useSearchParams` exige Suspense** no App Router — envolver `<Analytics />`/`TrackView` se o build reclamar.
- **Não colocar GA no root layout** — vazaria tracking pra dentro do app autenticado `(crm)`.
- **Dedupe de conversão:** não contar GA4-importado E tag AW- na mesma coluna de conversões do Ads.
- **`page_view` duplicado:** por isso `send_page_view: false` no config + disparo manual no `useEffect`.
- **Consentimento ≠ aceite de Termos:** o checkbox `aceite_termo` do cadastro não cobre cookies; precisa do banner.
- **CTA do header** aponta para `/login` (não `/cadastro`) — corrigir antes de tirar conclusões do funil.
