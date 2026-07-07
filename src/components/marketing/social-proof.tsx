'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Counter, EASE_OUT } from './motion'

const STATS = [
  {
    prefix: '',
    value: 100,
    suffix: '%',
    label: 'da operação num lugar',
    sub: 'vendas, financeiro e contratos sem planilha paralela',
  },
  {
    prefix: 'R$ ',
    value: 0,
    suffix: '',
    label: 'de setup',
    sub: 'começa a funcionar no mesmo dia, sem consultoria',
  },
  {
    prefix: '',
    value: 30,
    suffix: ' min',
    label: 'para estar no ar',
    sub: 'da conta criada ao primeiro registro no sistema',
  },
  {
    prefix: '',
    value: 14,
    suffix: ' dias',
    label: 'de teste grátis',
    sub: 'sem cartão de crédito para começar',
  },
]

export function SocialProof() {
  const reduce = useReducedMotion()

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
        {/* Citação */}
        <motion.blockquote
          className="mb-16 max-w-3xl"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <p className="text-[clamp(1.3rem,2.8vw,2rem)] font-semibold leading-[1.2] tracking-[-0.02em] text-balance">
            &ldquo;Construímos o CRM Studio pra tirar a PME brasileira da planilha —
            toda a operação num lugar só, com preço que não pune o crescimento.&rdquo;
          </p>
          <footer className="mt-5 text-sm text-muted-foreground">
            CRM Studio
          </footer>
        </motion.blockquote>

        {/* Grid de números */}
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              className="bg-card px-6 py-7"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, ease: EASE_OUT, delay: i * 0.07 }}
            >
              <Counter
                to={s.value}
                prefix={s.prefix}
                suffix={s.suffix}
                className="font-heading text-3xl font-bold tracking-[-0.02em] text-foreground lg:text-4xl"
              />
              <p className="mt-1.5 text-[14px] font-semibold text-foreground/80">{s.label}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
