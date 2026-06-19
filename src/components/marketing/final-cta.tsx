'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { EASE_OUT } from './motion'

export function FinalCta() {
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      {/* Gradiente animado de fundo */}
      {!reduce && (
        <>
          <motion.div
            className="pointer-events-none absolute -left-32 -top-32 size-80 rounded-full bg-accent/10 blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
          <motion.div
            className="pointer-events-none absolute -bottom-24 -right-24 size-96 rounded-full bg-accent/8 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Conteúdo */}
      <div className="relative mx-auto max-w-[1180px] px-6 py-24 text-center sm:px-8 lg:py-32">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: EASE_OUT }}
        >
          <h2 className="mx-auto max-w-3xl text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.01] tracking-[-0.035em]">
            Comece a organizar seu negócio{' '}
            <span className="text-accent">hoje.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-primary-foreground/70">
            Ative os módulos que você precisa. Configuração em menos de 30 minutos.
            Sem cartão para começar.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/cadastro"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-9 py-4 text-[15px] font-semibold text-white shadow-[0_4px_28px_rgba(232,145,91,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_36px_rgba(232,145,91,0.5)] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              Começar grátis
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/contato"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-9 py-4 text-[15px] font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              Falar com a gente
            </Link>
          </div>

          {/* Sub-garantia */}
          <p className="mt-6 text-sm text-primary-foreground/50">
            7 dias grátis - sem cartão - suporte em PT-BR
          </p>
        </motion.div>
      </div>
    </section>
  )
}
