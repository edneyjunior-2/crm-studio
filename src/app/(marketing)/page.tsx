import { Hero } from '@/components/marketing/hero'
import { InfiniteSlider } from '@/components/marketing/infinite-slider'
import { ShowcaseWrapper } from '@/components/marketing/showcase-wrapper'
import { FeaturesGrid } from '@/components/marketing/features-grid'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { FinancialSpotlight } from '@/components/marketing/financial-spotlight'
import { SocialProof } from '@/components/marketing/social-proof'
import { FinalCta } from '@/components/marketing/final-cta'

export const metadata = {
  title: 'CRM Studio · Vendas, financeiro e equipe em um só lugar',
  description:
    'CRM brasileiro para PMEs: pipeline de vendas, financeiro nativo e calendário integrado ao Google. A venda que fecha vira dinheiro no caixa.',
}

export default function HomePage() {
  return (
    <>
      {/* 1. Hero com texto animado e grade de pontos */}
      <Hero />

      {/* 2. Faixa de frases de valor em loop infinito */}
      <InfiniteSlider />

      {/* 3. Showcase do produto com browser mockup */}
      <ShowcaseWrapper />

      {/* 4. Grid de features (scroll-driven stagger) */}
      <FeaturesGrid />

      {/* 5. Como funciona — timeline de 3 passos */}
      <HowItWorks />

      {/* 6. Spotlight financeiro — a história venda → caixa */}
      <FinancialSpotlight />

      {/* 7. Prova social com contadores animados */}
      <SocialProof />

      {/* 8. CTA final impactante */}
      <FinalCta />
    </>
  )
}
