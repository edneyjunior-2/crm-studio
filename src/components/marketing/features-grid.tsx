'use client'

import { motion, useReducedMotion } from 'motion/react'
import {
  TrendingUp,
  Landmark,
  Users,
  CalendarDays,
  Package,
  UserSquare2,
} from 'lucide-react'
import { EASE_OUT, Tilt, BorderTrail } from './motion'

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Pipeline de vendas',
    desc: 'Funil visual do primeiro contato ao fechado, com previsão de receita por etapa e alertas de SLA.',
    accent: false,
  },
  {
    icon: Landmark,
    title: 'Financeiro nativo',
    desc: 'Contas a pagar e a receber nascem das vendas. Multi-moeda, comissões e fluxo de caixa automático.',
    accent: true,
  },
  {
    icon: Users,
    title: 'Clientes e parceiros',
    desc: 'Carteira protegida por território, busca de CNPJ automática e comissão de indicação integrada.',
    accent: false,
  },
  {
    icon: CalendarDays,
    title: 'Calendário da equipe',
    desc: 'Reuniões sincronizadas com o Google Calendar de cada vendedor, sem sair do CRM.',
    accent: false,
  },
  {
    icon: Package,
    title: 'Estoque',
    desc: 'Produtos, saldo e movimentações ligados diretamente às vendas. Sem separação de sistema.',
    soon: true,
    accent: false,
  },
  {
    icon: UserSquare2,
    title: 'Recursos humanos',
    desc: 'Equipe, cargos e folha simplificada integrada ao financeiro da empresa.',
    soon: true,
    accent: false,
  },
]

export function FeaturesGrid() {
  const reduce = useReducedMotion()

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
        {/* Cabeçalho */}
        <motion.div
          className="mb-14 max-w-2xl"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.04] tracking-[-0.03em]">
            Tudo que o seu comercial precisa,{' '}
            <span className="text-muted-foreground">sem mais um sistema separado.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Seis frentes que normalmente moram em quatro ferramentas diferentes,
            conversando entre si num só lugar.
          </p>
        </motion.div>

        {/* Grid de cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.06 }}
                whileHover={reduce ? {} : { y: -3 }}
                className="transition-shadow duration-200 hover:shadow-[0_8px_30px_rgba(20,35,58,0.09)]"
              >
                <Tilt>
                  <BorderTrail
                    className={`group relative overflow-hidden rounded-2xl border p-6 ${
                      f.accent
                        ? 'border-accent/30 bg-accent/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    {/* Ícone */}
                    <motion.div
                      className={`mb-4 inline-flex size-11 items-center justify-center rounded-xl ${
                        f.accent
                          ? 'bg-accent/15 text-accent'
                          : 'bg-secondary text-foreground'
                      }`}
                      whileHover={reduce ? {} : { scale: 1.1, rotate: -4 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    >
                      <Icon className="size-5" strokeWidth={1.7} />
                    </motion.div>

                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[17px] font-semibold leading-snug">{f.title}</h3>
                      {f.soon && (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                      {f.desc}
                    </p>

                    {/* Detalhe de fundo sutil */}
                    {f.accent && (
                      <div
                        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-accent/10 blur-2xl"
                        aria-hidden="true"
                      />
                    )}
                  </BorderTrail>
                </Tilt>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
