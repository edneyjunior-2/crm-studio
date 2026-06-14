import Link from 'next/link'
import { Check } from 'lucide-react'
import { Reveal } from '@/components/marketing/motion'

export const metadata = {
  title: 'Preços · CRM Studio',
  description: 'Planos simples, preço fixo por empresa. Comece grátis por 14 dias, sem cartão.',
}

const PLANOS = [
  {
    name: 'Starter',
    price: 'R$ 149',
    tagline: 'Para o time pequeno organizar o funil.',
    cta: 'Começar grátis',
    href: '/login',
    featured: false,
    features: ['Pipeline de vendas', 'Gestão de clientes', 'Calendário Google', 'Suporte por e-mail'],
  },
  {
    name: 'Pro',
    price: 'R$ 449',
    tagline: 'O comercial inteiro, com financeiro nativo.',
    cta: 'Começar grátis',
    href: '/login',
    featured: true,
    features: ['Tudo do Starter', 'Financeiro completo', 'Comissões e parceiros', 'Automações de funil'],
  },
  {
    name: 'Business',
    price: 'R$ 990',
    tagline: 'Para a operação que precisa de tudo.',
    cta: 'Falar com vendas',
    href: '/contato',
    featured: false,
    features: ['Tudo do Pro', 'Estoque e RH (em breve)', 'Múltiplos funis', 'Conta dedicada'],
  },
]

const FAQ = [
  { q: 'O preço é por usuário?', a: 'Não. O valor é fixo por empresa, independente de quantas pessoas usam. Sem surpresa na conta quando o time cresce.' },
  { q: 'Preciso de cartão para testar?', a: 'Não. São 14 dias grátis sem cartão. Você só decide o plano quando estiver convencido.' },
  { q: 'Consigo migrar minha planilha?', a: 'Sim. A importação de clientes e contas faz parte da configuração inicial guiada.' },
]

export default function PrecosPage() {
  return (
    <>
      <section className="mx-auto max-w-[1180px] px-6 pb-12 pt-16 text-center sm:px-8 lg:pt-24">
        <Reveal>
          <h1 className="mx-auto max-w-3xl text-balance text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.04em]">
            Preço fixo por empresa. Sem pegadinha por usuário.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
            Comece grátis por 14 dias, sem cartão. Cancele quando quiser.
          </p>
        </Reveal>
      </section>

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
