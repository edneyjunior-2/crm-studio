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
  CalendarClock,
  FolderArchive,
  Receipt,
  Ruler,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react'
import { EASE_OUT, Tilt, BorderTrail } from './motion'

type Feature = { icon: LucideIcon; title: string; desc: string; accent?: boolean }
type Grupo = { label: string; sub: string; features: Feature[] }

const GRUPOS: Grupo[] = [
  {
    label: 'Para todo negócio',
    sub: 'O núcleo comercial e financeiro — em qualquer plano.',
    features: [
      {
        icon: TrendingUp,
        title: 'Pipeline de vendas',
        desc: 'Funil visual com arrastar e soltar, probabilidade de fechamento e histórico de cada oportunidade. Do lead ao contrato.',
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
      },
      {
        icon: Users,
        title: 'Clientes e relacionamentos',
        desc: 'Histórico completo, contatos e atividades por cliente. Busca automática de CNPJ e controle de toda a carteira.',
      },
      {
        icon: CalendarDays,
        title: 'Agenda e atividades',
        desc: 'Reuniões, tarefas e lembretes sincronizados com o Google Calendar de cada usuário. Nunca perca um compromisso.',
      },
      {
        icon: FileSignature,
        title: 'Contratos',
        desc: 'Gerador de contratos white-label, com a sua marca e os seus modelos. O parceiro entra no cadastro automaticamente, sem retrabalho.',
      },
      {
        icon: Package,
        title: 'Estoque e operações',
        desc: 'Controle de produtos, saldo e movimentações conectados às operações. Add-on no Pro, incluso no Business.',
      },
      {
        icon: Bot,
        title: 'SDR WhatsApp · IA',
        desc: 'Agente de IA que prospecta, qualifica leads e os lança direto no pipeline automaticamente. Add-on disponível em qualquer plano.',
      },
    ],
  },
  {
    label: 'Para advocacia',
    sub: 'Escritórios e departamentos jurídicos.',
    features: [
      {
        icon: Scale,
        title: 'Processos via DataJud',
        desc: 'Movimentações sincronizadas automaticamente pelo número CNJ. A cada andamento novo, o advogado responsável é avisado por e-mail.',
        accent: true,
      },
      {
        icon: CalendarClock,
        title: 'Prazos e audiências',
        desc: 'Prazos com alerta antes de vencer e audiências que viram evento no Google Calendar, com o responsável já marcado.',
      },
      {
        icon: FolderArchive,
        title: 'Documentos do processo',
        desc: 'Petições, decisões e anexos guardados por processo (GED), junto do andamento — sem pasta solta no computador.',
      },
      {
        icon: Receipt,
        title: 'Honorários e custas',
        desc: 'Honorários (fixo ou percentual da causa) e guias viram lançamento no financeiro, sem digitar duas vezes.',
      },
    ],
  },
  {
    label: 'Para engenharia e obras',
    sub: 'Construção civil e gestão de obras.',
    features: [
      {
        icon: HardHat,
        title: 'Obras e etapas',
        desc: 'Cada obra com etapas, percentual de avanço, valor de contrato e responsável — do orçamento à entrega.',
        accent: true,
      },
      {
        icon: Ruler,
        title: 'Orçamento SINAPI',
        desc: 'Monte o orçamento com o catálogo SINAPI por UF e mês, BDI e desoneração, e gere o PDF para o cliente.',
      },
      {
        icon: ClipboardCheck,
        title: 'Medições',
        desc: 'Boletins de medição por percentual e valor, com avanço de status até o faturamento.',
      },
      {
        icon: Users,
        title: 'Equipe e ponto',
        desc: 'Equipe alocada por obra e ponto integrado, com atestado anexado nas faltas.',
      },
    ],
  },
]

function FeatureCard({ f, i, reduce }: { f: Feature; i: number; reduce: boolean | null }) {
  const Icon = f.icon
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.06 }}
      whileHover={reduce ? {} : { y: -3 }}
      className="transition-shadow duration-200 hover:shadow-[0_8px_30px_rgba(20,35,58,0.09)]"
    >
      <Tilt>
        <BorderTrail
          className={`group relative h-full overflow-hidden rounded-2xl border p-6 ${
            f.accent ? 'border-accent/30 bg-accent/5' : 'border-border bg-card'
          }`}
        >
          {/* Ícone */}
          <motion.div
            className={`mb-4 inline-flex size-11 items-center justify-center rounded-xl ${
              f.accent ? 'bg-accent/15 text-accent' : 'bg-secondary text-foreground'
            }`}
            whileHover={reduce ? {} : { scale: 1.1, rotate: -4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <Icon className="size-5" strokeWidth={1.7} />
          </motion.div>

          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[17px] font-semibold leading-snug">{f.title}</h3>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{f.desc}</p>

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
}

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

        {/* Grupos por setor */}
        <div className="space-y-16">
          {GRUPOS.map((g) => (
            <div key={g.label}>
              {/* Cabeçalho do grupo */}
              <motion.div
                className="mb-6"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              >
                <div className="flex items-center gap-3">
                  <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                    {g.label}
                  </span>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{g.sub}</p>
              </motion.div>

              {/* Cards do grupo */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.features.map((f, i) => (
                  <FeatureCard key={f.title} f={f} i={i} reduce={reduce} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
