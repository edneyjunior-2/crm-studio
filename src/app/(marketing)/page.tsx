import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Hero } from '@/components/marketing/hero'
import { Reveal } from '@/components/marketing/motion'

export const metadata = {
  title: 'CRM Studio · Vendas, financeiro e equipe em um só lugar',
  description:
    'CRM brasileiro para PMEs: pipeline de vendas, financeiro nativo e calendário integrado ao Google. A venda que fecha vira dinheiro no caixa.',
}

const MODULOS = [
  { n: '01', title: 'Pipeline de vendas', desc: 'Funil visual do primeiro contato ao fechado, com previsão de receita por etapa.' },
  { n: '02', title: 'Financeiro', desc: 'Contas a pagar e a receber, multi-moeda e comissões nascendo das vendas fechadas.' },
  { n: '03', title: 'Clientes e parceiros', desc: 'Carteira protegida por território, busca de CNPJ automática e comissão de indicação.' },
  { n: '04', title: 'Calendário', desc: 'Reuniões da equipe sincronizadas com o Google Calendar de cada vendedor.' },
  { n: '05', title: 'Estoque', desc: 'Produtos, saldo e movimentações ligados às vendas.', soon: true },
  { n: '06', title: 'Recursos humanos', desc: 'Equipe, cargos e folha simplificada integrada ao financeiro.', soon: true },
]

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Módulos — lista editorial numerada (não grid de cards) */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
          <Reveal>
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.02] tracking-[-0.03em]">
                Tudo que o seu comercial precisa, sem mais um sistema separado.
              </h2>
              <p className="max-w-md self-end text-lg leading-relaxed text-muted-foreground">
                Seis frentes que normalmente moram em quatro ferramentas diferentes, conversando
                entre si dentro de um só lugar.
              </p>
            </div>
          </Reveal>

          <ul className="mt-16 divide-y divide-border border-t border-border">
            {MODULOS.map((m, i) => (
              <Reveal as="li" key={m.n} delay={i * 0.04}>
                <div className="group grid grid-cols-[auto_1fr] items-baseline gap-6 py-7 sm:grid-cols-[5rem_1fr_auto] sm:gap-10">
                  <span className="font-heading text-3xl font-semibold tabular-nums text-accent/70 sm:text-4xl">
                    {m.n}
                  </span>
                  <div className="col-span-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold sm:text-2xl">{m.title}</h3>
                      {m.soon && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{m.desc}</p>
                  </div>
                  <Link
                    href="/produto"
                    aria-label={`Saber mais sobre ${m.title}`}
                    className="hidden size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground sm:flex"
                  >
                    <ArrowUpRight className="size-4" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Spotlight financeiro — o outro lado da história (venda → caixa) */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div>
                <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.03em]">
                  Quando você fecha, o financeiro já sabe.
                </h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-primary-foreground/70">
                  Todo negócio ganho no funil cria a conta a receber, calcula a comissão e entra na
                  previsão de caixa, na hora. Ninguém digita a mesma venda duas vezes, e o número que
                  você vê é o número de verdade.
                </p>
                <Link
                  href="/produto"
                  className="mt-8 inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent transition-opacity hover:opacity-80"
                >
                  Ver como o financeiro funciona
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Negócio ganho</span>
                    <span className="text-sm font-semibold tabular-nums text-chart-5">R$ 22.000</span>
                  </div>
                  <p className="mt-1 text-xs text-primary-foreground/50">Plano anual · fechado hoje</p>
                </div>
                <div className="my-3 flex justify-center text-primary-foreground/40">
                  <ArrowRight className="size-5 rotate-90" />
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between rounded-xl bg-white/[0.06] px-4 py-3 text-sm">
                    <span className="text-primary-foreground/80">Conta a receber</span>
                    <span className="font-semibold tabular-nums">R$ 22.000</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/[0.06] px-4 py-3 text-sm">
                    <span className="text-primary-foreground/80">Comissão do vendedor</span>
                    <span className="font-semibold tabular-nums">R$ 1.760</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
                    <span className="font-medium">Previsão de caixa (30d)</span>
                    <span className="font-semibold tabular-nums">atualizada</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Caso Aurum — prova real (origem/validação) */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
          <Reveal>
            <p className="text-sm font-medium text-muted-foreground">Caso real · Aurum Tax Advisory</p>
            {/* TODO: substituir por citação nominal de alguém da equipe Aurum quando autorizado. */}
            <blockquote className="mt-6 max-w-4xl text-balance text-[clamp(1.5rem,3.2vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.02em]">
              “Rodamos toda a operação comercial e o financeiro no CRM Studio antes dele virar produto.
              Saber que cada venda fechada já está no caixa mudou a nossa rotina.”
            </blockquote>
            <p className="mt-6 text-sm text-muted-foreground">Equipe comercial · Aurum Tax Advisory</p>
          </Reveal>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
            {[
              { k: 'Equipe', v: '4 pessoas', d: 'usando todos os dias' },
              { k: 'Tempo de uso', v: 'meses', d: 'em operação real, não piloto' },
              { k: 'Antes do produto', v: 'validado', d: 'no dia a dia antes de virar SaaS' },
            ].map((s) => (
              <div key={s.k} className="bg-card p-7">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.k}</div>
                <div className="mt-2 font-heading text-2xl font-bold tracking-[-0.01em]">{s.v}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-[1180px] px-6 py-20 text-center sm:px-8 lg:py-28">
          <Reveal>
            <h2 className="mx-auto max-w-3xl text-[clamp(2rem,4.5vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.03em]">
              Comece a organizar suas vendas hoje.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-lg text-primary-foreground/70">
              Configuração guiada em menos de 30 minutos. Sem cartão para começar.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-background px-7 py-3.5 text-[15px] font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Começar grátis
              </Link>
              <Link
                href="/contato"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-white/10"
              >
                Falar com vendas
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
