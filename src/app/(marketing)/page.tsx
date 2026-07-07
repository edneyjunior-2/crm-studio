import { Hero } from '@/components/marketing/hero'
import { InfiniteSlider } from '@/components/marketing/infinite-slider'
import { ShowcaseWrapper } from '@/components/marketing/showcase-wrapper'
import { FeaturesGrid } from '@/components/marketing/features-grid'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { FinancialSpotlight } from '@/components/marketing/financial-spotlight'
import { Objecoes } from '@/components/marketing/objecoes'
import { SocialProof } from '@/components/marketing/social-proof'
import { FinalCta } from '@/components/marketing/final-cta'

export const metadata = {
  title: 'CRM Studio · Saia das planilhas e organize todo o seu negócio',
  description:
    'CRM brasileiro para PMEs: tire vendas, financeiro, contratos e equipe do Excel e coloque num sistema só. Preço fixo por empresa, versões prontas pra advocacia e engenharia. Teste grátis 14 dias, sem cartão.',
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

      {/* 7. Quebra de objeções — antes de largar a planilha */}
      <Objecoes />

      {/* 8. Prova social com contadores animados */}
      <SocialProof />

      {/* 9. CTA final impactante */}
      <FinalCta />
    </>
  )
}
