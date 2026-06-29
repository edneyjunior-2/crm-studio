import Link from 'next/link'
import { Check, Zap, Scale, HardHat } from 'lucide-react'
import { Reveal } from '@/components/marketing/motion'

export const metadata = {
  title: 'Preços · CRM Studio',
  description: 'Preço fixo por empresa, módulos que se adaptam ao seu negócio. 14 dias grátis, sem cartão.',
}

const PLANOS = [
  {
    name: 'Starter',
    price: 'R$ 147',
    tagline: 'Para o time pequeno organizar o funil.',
    cta: 'Começar grátis',
    href: '/cadastro',
    featured: false,
    features: [
      'Até 3 usuários',
      'Pipeline de vendas',
      'Gestão de clientes',
      'Financeiro básico',
      'Calendário Google',
      'Suporte por e-mail',
    ],
  },
  {
    name: 'Pro',
    price: 'R$ 297',
    tagline: 'O comercial inteiro, com financeiro nativo.',
    cta: 'Começar grátis',
    href: '/cadastro',
    featured: true,
    features: [
      'Usuários ilimitados',
      'Tudo do Starter',
      'Financeiro completo',
      'Contratos e assinatura eletrônica',
      'Chat Inbox (WhatsApp)',
      'Comissões e parceiros',
      'Módulos add-on disponíveis',
    ],
  },
  {
    name: 'Business',
    price: 'R$ 497',
    tagline: 'Operação completa, sem escolher módulo.',
    cta: 'Começar grátis',
    href: '/cadastro',
    featured: false,
    features: [
      'Usuários ilimitados',
      'Tudo do Pro',
      'Módulo Estoque incluso',
      'Módulo RH leve incluso',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
  },
]

const ADDONS = [
  {
    name: 'Módulo Estoque',
    price: '+R$ 99/mês',
    desc: 'Controle de produtos, saldo e movimentações. Disponível para o plano Pro.',
  },
  {
    name: 'Módulo RH leve',
    price: '+R$ 99/mês',
    desc: 'Ponto, escala, organograma e documentos. Disponível para o plano Pro.',
    note: 'Pro + Estoque + RH = R$ 495 → quase igual ao Business (R$ 497), com tudo incluso.',
  },
  {
    name: 'SDR WhatsApp · Essencial',
    price: '+R$ 97/mês',
    desc: 'Agente de IA que prospecta, qualifica e lança leads no CRM automaticamente. Até 300 conversas/mês.',
  },
  {
    name: 'SDR WhatsApp · Avançado',
    price: '+R$ 197/mês',
    desc: 'Mesma automação com capacidade ampliada. Até 1.000 conversas/mês.',
  },
]

const VERTICAIS = [
  {
    icon: Scale,
    setor: 'Advocacia',
    plano: 'R$ 247/mês',
    modulos: ['CRM + Pipeline', 'Financeiro com honorários', 'Processos jurídicos / DataJud', 'Chat Inbox'],
  },
  {
    icon: HardHat,
    setor: 'Engenharia e Obras',
    plano: 'R$ 347/mês',
    modulos: ['CRM + Pipeline', 'Financeiro de obras', 'Estoque e materiais', 'Gestão de contratos'],
    badge: 'Em breve',
  },
  {
    icon: Zap,
    setor: 'Comercial / Vendas',
    plano: 'A partir de R$ 147/mês',
    modulos: ['CRM + Pipeline completo', 'Financeiro integrado', 'SDR WhatsApp (add-on)', 'Comissões e parceiros'],
  },
]

const FAQ = [
  {
    q: 'O preço é por usuário?',
    a: 'Não. O valor é fixo por empresa, independente de quantas pessoas usam. Sem surpresa na conta quando o time cresce.',
  },
  {
    q: 'Os módulos podem ser adaptados para o meu tipo de negócio?',
    a: 'Sim — essa é a proposta do CRM Studio. Você ativa os módulos que fazem sentido para o seu setor, combina com add-ons e, se o seu segmento tiver um plano vertical (como advocacia ou engenharia), a combinação já vem pronta com o preço ajustado.',
  },
  {
    q: 'O que é o SDR WhatsApp?',
    a: 'É um agente de inteligência artificial que conversa com seus leads no WhatsApp, qualifica o interesse e cria o contato automaticamente no CRM. É um add-on — você contrata por cima de qualquer plano base.',
  },
  {
    q: 'Preciso de cartão para testar?',
    a: 'Não. São 14 dias grátis sem cartão. Você só decide o plano quando estiver convencido.',
  },
  {
    q: 'Consigo migrar minha planilha?',
    a: 'Sim. A importação de clientes e contas faz parte da configuração inicial guiada.',
  },
  {
    q: 'E se eu precisar de um módulo que não existe ainda?',
    a: 'Fale com a gente. Construímos módulos verticais sob demanda para setores com volume de clientes — e os primeiros clientes de cada setor entram com condições especiais.',
  },
]

export default function PrecosPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-[1180px] px-6 pb-12 pt-16 text-center sm:px-8 lg:pt-24">
        <Reveal>
          <h1 className="mx-auto max-w-3xl text-balance text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.04em]">
            Preço fixo por empresa. Módulos que se adaptam a você.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
            14 dias grátis, sem cartão. Ative só o que faz sentido para o seu negócio.
          </p>
        </Reveal>
      </section>

      {/* Planos base */}
      <section className="mx-auto max-w-[1180px] px-6 pb-8 sm:px-8">
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {PLANOS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.06}>
              <div
                className={`flex h-full flex-col rounded-2xl border p-7 ${
                  p.featured ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-base font-semibold">{p.name}</span>
                  {p.featured && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                      Mais escolhido
                    </span>
                  )}
                </div>
                <p className={`mt-2 min-h-10 text-sm ${p.featured ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {p.tagline}
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-bold tracking-[-0.02em] tabular-nums">{p.price}</span>
                  <span className={`text-sm ${p.featured ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>/mês</span>
                </div>
                <Link
                  href={p.href}
                  className={`mt-6 rounded-full px-5 py-3 text-center text-sm font-semibold transition-opacity hover:opacity-90 ${
                    p.featured ? 'bg-accent text-accent-foreground' : 'bg-foreground text-background'
                  }`}
                >
                  {p.cta}
                </Link>
                <ul className="mt-7 flex flex-col gap-3">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-center gap-2.5 text-[14px] ${p.featured ? 'text-primary-foreground/85' : 'text-muted-foreground'}`}
                    >
                      <Check className="size-4 shrink-0 text-accent" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      <section className="mx-auto max-w-[1180px] px-6 py-16 sm:px-8">
        <Reveal>
          <div className="mb-10">
            <h2 className="text-[clamp(1.6rem,3vw,2.25rem)] font-bold tracking-[-0.03em]">Add-ons</h2>
            <p className="mt-2 text-muted-foreground">
              Contrate por cima de qualquer plano. Ative o que precisar, quando precisar.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {ADDONS.map((a, i) => (
            <Reveal key={a.name} delay={i * 0.05}>
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-snug">{a.name}</h3>
                  <span className="shrink-0 font-heading text-sm font-bold text-accent">{a.price}</span>
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{a.desc}</p>
                {a.note && (
                  <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                    💡 {a.note}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Planos verticais */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1180px] px-6 py-16 sm:px-8">
          <Reveal>
            <div className="mb-10">
              <h2 className="text-[clamp(1.6rem,3vw,2.25rem)] font-bold tracking-[-0.03em]">
                Planos por setor
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Combinações prontas para o seu mercado — módulos selecionados e preço ajustado para a realidade do setor.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-5 lg:grid-cols-3">
            {VERTICAIS.map((v, i) => {
              const Icon = v.icon
              return (
                <Reveal key={v.setor} delay={i * 0.06}>
                  <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                        <Icon className="size-5" strokeWidth={1.7} />
                      </div>
                      {v.badge && (
                        <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {v.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading text-lg font-semibold">{v.setor}</h3>
                    <p className="mt-1 text-sm font-semibold text-accent">{v.plano}</p>
                    <ul className="mt-4 flex flex-col gap-2">
                      {v.modulos.map((m) => (
                        <li key={m} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                          <Check className="size-3.5 shrink-0 text-accent" />
                          {m}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/contato"
                      className="mt-6 rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold transition-colors hover:bg-secondary"
                    >
                      Falar com a gente
                    </Link>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.6fr_1.4fr] lg:gap-20">
          <Reveal>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em]">
              Antes de decidir.
            </h2>
          </Reveal>
          <div className="divide-y divide-border border-t border-border">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.05}>
                <div className="py-6">
                  <h3 className="text-lg font-semibold">{item.q}</h3>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
