'use client'

import { motion, useReducedMotion } from 'motion/react'
import {
  TrendingUp,
  Landmark,
  Users,
  CalendarDays,
  Package,
  Layers,
} from 'lucide-react'
import { EASE_OUT, Tilt, BorderTrail } from './motion'

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Gestão comercial',
    desc: 'Funil de vendas visual, carteira de clientes e portfólio de produtos ou serviços. Do primeiro contato ao fechamento, tudo registrado.',
    accent: false,
  },
  {
    icon: Landmark,
    title: 'Financeiro integrado',
    desc: 'Contas a pagar e a receber conectadas às operações. Fluxo de caixa atualizado em tempo real, sem dupla entrada em nenhum lugar.',
    accent: true,
  },
  {
    icon: Users,
    title: 'Clientes e relacionamentos',
    desc: 'Histórico completo de cada cliente, contatos e atividades organizados por empresa. Busca automática de CNPJ incluída.',
    accent: false,
  },
  {
    icon: CalendarDays,
    title: 'Agenda e atividades',
    desc: 'Reuniões, tarefas e lembretes sincronizados com o Google Calendar de cada usuário. Nunca perca um compromisso.',
    accent: false,
  },
  {
    icon: Package,
    title: 'Estoque e operações',
    desc: 'Controle de produtos, saldo e movimentações conectados diretamente às operações do negócio. Sem sistema separado.',
    soon: true,
    accent: false,
  },
  {
    icon: Layers,
    title: 'Módulos por setor',
    desc: 'Em construção: módulos para engenharia, saúde, jurídico, construção civil e mais. Ative o que o seu setor exige.',
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
            Tudo que a sua empresa precisa,{' '}
            <span className="text-muted-foreground">num só sistema.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Ative os módulos que fazem sentido para o seu negócio. Quando uma
            área cresce, você adiciona o módulo — sem trocar de sistema.
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
