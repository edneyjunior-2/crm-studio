'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Enter } from './motion'

export function Hero() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-10 pt-16 sm:px-8 lg:pb-12 lg:pt-24">
      <div className="max-w-3xl">
        <Enter>
          <p className="mb-6 text-sm font-medium text-muted-foreground">
            CRM + financeiro, feito no Brasil para quem vende.
          </p>
        </Enter>
        <Enter delay={0.08}>
          <h1 className="text-balance text-[clamp(2rem,8vw,5.75rem)] font-bold leading-[0.98] tracking-[-0.04em] sm:leading-[0.95]">
            A venda que fecha vira <span className="text-accent">dinheiro no caixa</span>.
          </h1>
        </Enter>
        <Enter delay={0.16}>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted-foreground sm:text-xl">
            O CRM Studio junta pipeline de vendas, financeiro e equipe num só lugar. O que você fecha
            no funil já entra no fluxo de caixa, sem planilha e sem digitar duas vezes.
          </p>
        </Enter>
        <Enter delay={0.24}>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-7 py-3.5 text-[15px] font-semibold text-background transition-transform hover:-translate-y-0.5"
            >
              Começar grátis
            </Link>
            <Link
              href="/contato"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-7 py-3.5 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Falar com vendas
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </Enter>
        <Enter delay={0.32}>
          <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
            Nascido dentro da operação da Aurum, usado todo dia por uma equipe comercial real antes de
            virar produto.
          </p>
        </Enter>
      </div>
    </section>
  )
}
