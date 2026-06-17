'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { EASE_OUT } from './motion'

export function FinancialSpotlight() {
  const reduce = useReducedMotion()

  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Texto */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, ease: EASE_OUT }}
          >
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.02] tracking-[-0.03em]">
              Quando você fecha,{' '}
              <span className="text-accent">o financeiro já sabe.</span>
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-primary-foreground/70">
              Todo negócio ganho no funil cria a conta a receber, calcula a comissão
              e entra na previsão de caixa, na hora. Ninguém digita a mesma venda
              duas vezes, e o número que você vê é o número de verdade.
            </p>
            <Link
              href="/produto"
              className="mt-8 inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent transition-opacity hover:opacity-80"
            >
              Ver como o financeiro funciona
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>

          {/* Card visual */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: 28, scale: 0.97 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, ease: EASE_OUT, delay: 0.1 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            {/* Negócio ganho */}
            <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Negócio ganho</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-chart-5">
                  R$ 22.000
                </span>
              </div>
              <p className="mt-1 text-xs text-primary-foreground/50">
                Plano anual - fechado hoje
              </p>
            </div>

            {/* Seta */}
            <div className="my-3 flex justify-center">
              <motion.div
                animate={reduce ? {} : { y: [0, 4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ArrowRight className="size-5 rotate-90 text-primary-foreground/40" />
              </motion.div>
            </div>

            {/* Resultados automáticos */}
            <div className="flex flex-col gap-2.5">
              {[
                { label: 'Conta a receber', value: 'R$ 22.000', tone: '' },
                { label: 'Comissão do vendedor', value: 'R$ 1.760', tone: '' },
              ].map((row, i) => (
                <motion.div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl bg-white/[0.06] px-4 py-3 text-sm"
                  initial={reduce ? false : { opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.2 + i * 0.08 }}
                >
                  <span className="text-primary-foreground/80">{row.label}</span>
                  <span className="font-mono font-semibold tabular-nums">{row.value}</span>
                </motion.div>
              ))}
              <motion.div
                className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm text-white"
                initial={reduce ? false : { opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.36 }}
              >
                <span className="font-medium">Previsão de caixa (30d)</span>
                <span className="font-semibold">atualizada</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
