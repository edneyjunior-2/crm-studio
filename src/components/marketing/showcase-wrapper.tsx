'use client'

import { motion, useReducedMotion } from 'motion/react'
import { ProductShowcase } from './product-showcase'
import { EASE_OUT } from './motion'

export function ShowcaseWrapper() {
  const reduce = useReducedMotion()

  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-4 pt-4 sm:px-8">
      {/* Browser mockup frame */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97, y: 16 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="overflow-hidden rounded-2xl border border-border shadow-[0_32px_80px_-24px_rgba(20,35,58,0.22)]"
      >
        {/* Barra do browser */}
        <div className="flex h-10 items-center justify-between border-b border-border bg-muted/60 px-4">
          {/* Botões de janela */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-3 rounded-full bg-[#FF5F57]" />
            <span className="size-3 rounded-full bg-[#FFBD2E]" />
            <span className="size-3 rounded-full bg-[#28C840]" />
          </div>
          {/* URL fake */}
          <div className="flex h-6 items-center gap-1.5 rounded-md border border-border bg-background px-3">
            <span className="text-[11px] text-muted-foreground">app.crmstudio.com.br</span>
          </div>
          <div className="w-16" aria-hidden="true" />
        </div>

        {/* Showcase real do produto */}
        <div className="bg-background p-3 sm:p-4">
          <ProductShowcase />
        </div>
      </motion.div>

      <motion.p
        className="mt-4 text-center text-sm text-muted-foreground"
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.15 }}
      >
        Telas reais do CRM Studio com dados de exemplo. Troque de aba para ver o pipeline e o financeiro.
      </motion.p>
    </section>
  )
}
