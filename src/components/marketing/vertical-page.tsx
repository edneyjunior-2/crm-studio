import Link from 'next/link'
import { Check, type LucideIcon } from 'lucide-react'
import { Reveal } from './motion'
import { precoFormatado, type PlanoVendavel } from '@/lib/planos'

interface VerticalFeature {
  eyebrow: string
  title: string
  body: string
  points: string[]
}

interface VerticalFaqItem {
  q: string
  a: string
}

interface VerticalPageProps {
  plano: PlanoVendavel
  icon: LucideIcon
  eyebrow: string
  heroTitle: string
  heroSubtitle: string
  features: VerticalFeature[]
  faq: VerticalFaqItem[]
  ctaTitle: string
}

/**
 * Template compartilhado pelas páginas de vertical (/produto/advocacia,
 * /produto/engenharia, /produto/frete). Cada page.tsx só passa dados.
 */
export function VerticalPage({
  plano,
  icon: Icon,
  eyebrow,
  heroTitle,
  heroSubtitle,
  features,
  faq,
  ctaTitle,
}: VerticalPageProps) {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-[1180px] px-6 pb-12 pt-16 sm:px-8 lg:pt-24">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/8 px-4 py-1.5">
            <Icon className="size-4 text-accent" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-accent">{eyebrow}</span>
          </div>
          <h1 className="mt-6 max-w-3xl text-balance text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.04em]">
            {heroTitle}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {heroSubtitle}
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={`/cadastro?plano=${plano}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-4 text-[15px] font-semibold text-background shadow-[0_4px_24px_rgba(22,24,29,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(22,24,29,0.22)]"
            >
              Começar grátis — {precoFormatado(plano)}/mês
            </Link>
            <Link
              href="/precos"
              className="inline-flex items-center justify-center rounded-full border border-border px-8 py-4 text-[15px] font-semibold text-foreground transition-all duration-200 hover:border-foreground/30 hover:bg-muted hover:-translate-y-0.5"
            >
              Ver todos os planos
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      {features.map((f, i) => (
        <section key={f.eyebrow} className="border-t border-border">
          <div className="mx-auto max-w-[1180px] px-6 py-16 sm:px-8 lg:py-24">
            <Reveal>
              <div
                className={`grid items-start gap-10 lg:grid-cols-2 lg:gap-20 ${
                  i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-accent">{f.eyebrow}</p>
                  <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em]">
                    {f.title}
                  </h2>
                  <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
                <ul className="flex flex-col gap-3 lg:pt-12">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 border-b border-border pb-3 text-[15px]">
                      <Check className="size-4 shrink-0 text-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      {/* FAQ */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.6fr_1.4fr] lg:gap-20">
            <Reveal>
              <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em]">
                Perguntas frequentes.
              </h2>
            </Reveal>
            <div className="divide-y divide-border border-t border-border">
              {faq.map((item, i) => (
                <Reveal key={item.q} delay={i * 0.05}>
                  <div className="py-6">
                    <h3 className="text-lg font-semibold">{item.q}</h3>
                    <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-6 px-6 py-16 sm:px-8 md:flex-row md:items-center">
          <h2 className="max-w-xl text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">
            {ctaTitle}
          </h2>
          <Link
            href={`/cadastro?plano=${plano}`}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent px-7 py-3.5 text-[15px] font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5"
          >
            Começar grátis
          </Link>
        </div>
      </section>
    </>
  )
}
