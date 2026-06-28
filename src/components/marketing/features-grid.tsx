'use client'

import { motion, useReducedMotion } from 'motion/react'
import {
  TrendingUp,
  Landmark,
  Users,
  CalendarDays,
  Package,
  MessageSquare,
  Scale,
  HardHat,
  FileSignature,
  Bot,
} from 'lucide-react'
import { EASE_OUT, Tilt, BorderTrail } from './motion'

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Pipeline de vendas',
    desc: 'Funil visual com arrastar e soltar, probabilidade de fechamento e histórico completo de cada oportunidade. Do lead ao contrato.',
    accent: false,
  },
  {
    icon: Landmark,
    title: 'Financeiro integrado',
    desc: 'Contas a pagar e a receber conectadas às operações. Fluxo de caixa em tempo real, sem dupla entrada em lugar nenhum.',
    accent: true,
  },
  {
    icon: MessageSquare,
    title: 'Chat Inbox · WhatsApp',
    desc: 'Atendimento centralizado com histórico por cliente. A equipe inteira responde num só lugar, sem misturar com o celular pessoal.',
    accent: false,
  },
  {
    icon: Scale,
    title: 'Processos jurídicos',
    desc: 'Movimentações automáticas via DataJud, prazos com alerta de vencimento, audiências na agenda e documentos por processo. Honorários e custas caem direto no financeiro. Módulo sob medida para advocacia.',
    accent: false,
  },
  {
    icon: HardHat,
    title: 'Obras e engenharia',
    desc: 'Orçamento com base SINAPI, etapas, medições e equipe por obra. Do orçamento ao acompanhamento da execução, no mesmo CRM.',
    accent: false,
  },
  {
    icon: FileSignature,
    title: 'Contratos',
    desc: 'Gerador de contratos white-label, com a sua marca e os seus modelos. O parceiro do contrato entra no cadastro automaticamente, sem retrabalho.',
    accent: false,
  },
  {
    icon: Users,
    title: 'Clientes e relacionamentos',
    desc: 'Histórico completo, contatos e atividades por cliente. Busca automática de CNPJ e controle de toda a carteira.',
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
    desc: 'Controle de produtos, saldo e movimentações conectados às operações. Add-on no Pro, incluso no Business.',
    accent: false,
  },
  {
    icon: Bot,
    title: 'SDR WhatsApp · IA',
    desc: 'Agente de IA que prospecta, qualifica leads e os lança direto no pipeline automaticamente. Add-on disponível em qualquer plano.',
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
            Módulos que se adaptam{' '}
            <span className="text-muted-foreground">ao seu negócio.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Ative o que faz sentido para o seu setor. Advocacia, engenharia,
            comercial — cada empresa monta a combinação certa, sem pagar pelo
            que não usa.
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
