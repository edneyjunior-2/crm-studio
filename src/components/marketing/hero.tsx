'use client'

import Link from 'next/link'
import { ArrowUpRight, Check } from 'lucide-react'
import { Enter } from './motion'

export function Hero() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 pb-16 pt-16 sm:px-8 lg:pb-24 lg:pt-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <Enter delay={0}>
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              CRM + financeiro, feito no Brasil para quem vende.
            </p>
          </Enter>
          <Enter delay={0.08}>
            <h1 className="text-balance text-[clamp(2.75rem,6.5vw,5.25rem)] font-bold leading-[0.96] tracking-[-0.04em]">
              A venda que fecha vira <span className="text-accent">dinheiro no caixa</span>.
            </h1>
          </Enter>
          <Enter delay={0.16}>
            <p className="mt-6 max-w-[30rem] text-lg leading-relaxed text-muted-foreground">
              O CRM Studio junta pipeline de vendas, financeiro e equipe num só lugar.
              O que você fecha no funil já entra no fluxo de caixa, sem planilha e sem digitar duas vezes.
            </p>
          </Enter>
          <Enter delay={0.24}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-7 py-3.5 text-[15px] font-semibold text-background transition-transform hover:-translate-y-0.5"
              >
                Começar grátis
              </Link>
              <Link
                href="/contato"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-7 py-3.5 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Falar com vendas
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </Enter>
          <Enter delay={0.32}>
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Nascido dentro da operação da Aurum, usado todo dia por uma equipe comercial real
              antes de virar produto.
            </p>
          </Enter>
        </div>

        {/* Preview de produto — canônico (uma vez), sem rotate clichê, sem nomes fictícios */}
        <Enter delay={0.2} y={28}>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_30px_70px_-32px_rgba(20,35,58,0.35)]">
            <div className="flex items-center justify-between px-1 pb-4">
              <span className="text-[13px] font-semibold">Pipeline · junho</span>
              <span className="text-xs text-muted-foreground tabular-nums">R$ 612k em aberto</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { stage: 'Qualificação', n: 8, deals: [['LM', 'R$ 14,2k'], ['CR', 'R$ 9,8k']] },
                { stage: 'Proposta', n: 5, deals: [['AT', 'R$ 31,5k']] },
                { stage: 'Fechado', n: 12, deals: [['VG', 'R$ 22,0k'], ['KR', 'R$ 18,4k']], won: true },
              ].map((col) => (
                <div key={col.stage} className={`rounded-xl p-2.5 ${col.won ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`mb-2.5 flex items-center justify-between text-[11px] ${col.won ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    <span>{col.stage}</span>
                    <span className="tabular-nums">{col.n}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {col.deals.map(([who, val]) => (
                      <div
                        key={who}
                        className={`rounded-lg p-2 ${col.won ? 'border border-white/10 bg-white/[0.06]' : 'border border-border bg-card'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`flex size-5 items-center justify-center rounded-full text-[9px] font-semibold ${col.won ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                            {who}
                          </span>
                          <span className={`text-[12px] font-semibold tabular-nums ${col.won ? 'text-chart-5' : 'text-accent'}`}>{val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-[12px]">
              <span className="flex size-5 items-center justify-center rounded-full bg-chart-5/20 text-chart-5">
                <Check className="size-3" />
              </span>
              <span className="text-secondary-foreground">Negócio ganho · conta a receber criada automaticamente</span>
            </div>
          </div>
        </Enter>
      </div>
    </section>
  )
}
