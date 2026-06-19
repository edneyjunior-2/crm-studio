'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Enter, StaggerText, TextShimmer } from './motion'
import { HeroBg } from './hero-bg'
import { Spotlight } from './spotlight'
import { AppDemo } from './app-demo'

const EASE_OUT = [0.16, 1, 0.3, 1] as const

export function Hero() {
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden">
      {/* Fundo animado — grid de linhas + blob pulsante */}
      <HeroBg />

      {/* Spotlight que segue o cursor */}
      <Spotlight />

      {/* Conteúdo do hero — grid 2 colunas no desktop */}
      <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 px-6 pb-24 pt-36 sm:px-8 sm:pt-40 lg:grid-cols-[1fr_460px] lg:pt-44">
        <div>
          {/* Badge pill */}
          <Enter delay={0}>
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-accent/25 bg-accent/8 px-4 py-1.5">
              <span
                className="size-2 rounded-full bg-accent"
                style={
                  reduce
                    ? {}
                    : {
                        animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                      }
                }
              />
              <TextShimmer className="text-[13px] font-medium text-accent">
                Plataforma modular para PMEs brasileiras
              </TextShimmer>
            </div>
          </Enter>

          {/* Headline animada palavra por palavra */}
          <h1 className="text-[clamp(2.6rem,6vw,5rem)] font-bold leading-[0.97] tracking-[-0.04em] text-balance">
            <StaggerText
              text="Organize toda a operação,"
              delay={0.08}
              staggerDelay={0.055}
            />
            <br className="hidden sm:block" />
            <StaggerText
              text="do seu jeito."
              wordClassName="text-accent"
              delay={0.08 + 4 * 0.055}
              staggerDelay={0.055}
            />
          </h1>

          {/* Subtexto */}
          <Enter delay={0.44}>
            <p className="mt-7 max-w-[36rem] text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Módulos para cada área do seu negócio — comercial, financeiro,
              contratos, RH e mais. Ative só o que você precisa, tudo integrado,
              sem duplicar dados entre sistemas.
            </p>
          </Enter>

          {/* CTAs */}
          <Enter delay={0.54}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/cadastro"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-4 text-[15px] font-semibold text-background shadow-[0_4px_24px_rgba(22,24,29,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(22,24,29,0.22)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Começar grátis
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contato"
                className="inline-flex items-center justify-center rounded-full border border-border px-8 py-4 text-[15px] font-semibold text-foreground transition-all duration-200 hover:border-foreground/30 hover:bg-muted hover:-translate-y-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Falar com a gente
              </Link>
            </div>
          </Enter>

          {/* Stat strip */}
          <Enter delay={0.64}>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
              {['7 dias grátis', 'Sem cartão de crédito', 'Setup em 30 min'].map(
                (item, i) => (
                  <span
                    key={item}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    {i > 0 && (
                      <span className="hidden h-3 w-px bg-border sm:block" />
                    )}
                    <span
                      className="size-1.5 rounded-full bg-accent"
                      aria-hidden="true"
                    />
                    {item}
                  </span>
                )
              )}
            </div>
          </Enter>
        </div>

        {/* Demo do app — só desktop */}
        <Enter delay={0.3}>
          <div className="hidden lg:flex lg:justify-end">
            <AppDemo />
          </div>
        </Enter>

      </div>
    </section>
  )
}
