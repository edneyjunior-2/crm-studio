'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { EASE_OUT } from './motion'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const BRLk = (v: number) => `R$ ${Math.round(v / 1000)}k`

type TabKey = 'pipeline' | 'financeiro'

/* ----------------------------------------------------------- dados (demo) -- */

const PIPELINE: {
  stage: string
  won?: boolean
  deals: {
    titulo: string
    cliente: string
    valor: number
    prob?: number
    sla?: string
    adiado?: boolean
    periodicidade?: string
  }[]
}[] = [
  {
    stage: 'Qualificação',
    deals: [
      { titulo: 'Implantação do CRM', cliente: 'Metalúrgica Andrade', valor: 12400, prob: 35, sla: '6 dias' },
      { titulo: 'Consultoria fiscal', cliente: 'Verde Hortifruti', valor: 8900, prob: 25 },
    ],
  },
  {
    stage: 'Proposta',
    deals: [
      { titulo: 'Migração de ERP', cliente: 'Têxtil Bonfim', valor: 31500, prob: 60, sla: '4 dias' },
      { titulo: 'Plano anual', cliente: 'Clínica Vita', valor: 9800, prob: 50 },
    ],
  },
  {
    stage: 'Negociação',
    deals: [{ titulo: 'Expansão de licenças', cliente: 'Logística Recife', valor: 42000, prob: 75, adiado: true }],
  },
  {
    stage: 'Fechado Ganho',
    won: true,
    deals: [
      { titulo: 'Onboarding completo', cliente: 'Padaria Estrela', valor: 22000, periodicidade: 'Anual' },
      { titulo: 'Contrato mensal', cliente: 'Studio Alfa', valor: 18400, periodicidade: 'Mensal' },
    ],
  },
]

const KPIS: { label: string; value: number; Icon: typeof Landmark; tone: string }[] = [
  { label: 'Saldo em Caixa', value: 248500, Icon: Landmark, tone: 'text-chart-3 bg-chart-3/10' },
  { label: 'A Receber este mês', value: 96200, Icon: TrendingUp, tone: 'text-chart-5 bg-chart-5/10' },
  { label: 'A Pagar este mês', value: 54800, Icon: TrendingDown, tone: 'text-destructive bg-destructive/10' },
  { label: 'Resultado Previsto', value: 41400, Icon: Wallet, tone: 'text-accent bg-accent/10' },
]

const FLUXO = [
  { mes: 'jan', entradas: 62, saidas: 48 },
  { mes: 'fev', entradas: 71, saidas: 53 },
  { mes: 'mar', entradas: 68, saidas: 50 },
  { mes: 'abr', entradas: 84, saidas: 61 },
  { mes: 'mai', entradas: 79, saidas: 58 },
  { mes: 'jun', entradas: 96, saidas: 55 },
]
const FLUXO_MAX = Math.max(...FLUXO.flatMap((m) => [m.entradas, m.saidas]))

const VENCENDO: { desc: string; tipo: 'receber' | 'pagar'; valor: number; data: string }[] = [
  { desc: 'Mensalidade · Clínica Vita', tipo: 'receber', valor: 2400, data: '14/06' },
  { desc: 'Aluguel do escritório', tipo: 'pagar', valor: 6800, data: '16/06' },
  { desc: 'Comissão · João P.', tipo: 'pagar', valor: 1760, data: '18/06' },
]

/* ----------------------------------------------------------- pipeline UI -- */

function PipelineScreen({ stagger }: { stagger: (i: number) => object }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {PIPELINE.map((col, ci) => {
        const total = col.deals.reduce((s, d) => s + d.valor, 0)
        return (
          <div key={col.stage} className="w-[208px] shrink-0">
            <div className="mb-2.5 flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${col.won ? 'bg-chart-5' : 'bg-muted-foreground/40'}`} />
                <span className="text-[13px] font-semibold">{col.stage}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{col.deals.length}</span>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{BRLk(total)}</span>
            </div>
            <div className="flex flex-col gap-2">
              {col.deals.map((d, di) => (
                <motion.div
                  key={d.titulo}
                  {...stagger(ci * 2 + di)}
                  className="rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(20,35,58,0.04)]"
                >
                  <div className="text-[13px] font-medium leading-snug">{d.titulo}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{d.cliente}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold tabular-nums">{BRL(d.valor)}</span>
                    {d.prob != null && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground tabular-nums">
                        {d.prob}%
                      </span>
                    )}
                  </div>
                  {(d.sla || d.adiado || d.periodicidade) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.sla && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          <Clock className="size-2.5" />
                          {d.sla}
                        </span>
                      )}
                      {d.adiado && (
                        <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Prazo adiado
                        </span>
                      )}
                      {d.periodicidade && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-chart-5/30 bg-chart-5/10 px-2 py-0.5 text-[10px] font-medium text-chart-5">
                          <RefreshCw className="size-2.5" />
                          {d.periodicidade}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------- financeiro UI -- */

function FinanceiroScreen({ stagger, reduce }: { stagger: (i: number) => object; reduce: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((k, i) => (
          <motion.div
            key={k.label}
            {...stagger(i)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${k.tone}`}>
              <k.Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{k.label}</p>
              <p className="font-mono text-[15px] font-semibold tabular-nums">{BRL(k.value)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
          <h4 className="mb-4 text-[13px] font-semibold">Fluxo de caixa · últimos 6 meses</h4>
          <div className="flex h-36 items-end gap-3">
            {FLUXO.map((m, i) => (
              <div key={m.mes} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-28 w-full items-end justify-center gap-1">
                  <motion.span
                    className="w-1/2 rounded-t bg-chart-5"
                    style={{ height: `${(m.entradas / FLUXO_MAX) * 100}%`, transformOrigin: 'bottom' }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: reduce ? 0 : 0.15 + i * 0.05, duration: 0.5, ease: EASE_OUT }}
                  />
                  <motion.span
                    className="w-1/2 rounded-t bg-destructive/70"
                    style={{ height: `${(m.saidas / FLUXO_MAX) * 100}%`, transformOrigin: 'bottom' }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: reduce ? 0 : 0.2 + i * 0.05, duration: 0.5, ease: EASE_OUT }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{m.mes}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-5" /> Entradas</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive/70" /> Saídas</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="size-4 text-accent" />
            <h4 className="text-[13px] font-semibold">Vencendo nos próximos 7 dias</h4>
          </div>
          <div className="flex flex-col gap-2">
            {VENCENDO.map((v, i) => (
              <motion.div
                key={v.desc}
                {...stagger(i + 1)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`size-2 shrink-0 rounded-full ${v.tipo === 'receber' ? 'bg-chart-5' : 'bg-destructive'}`} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{v.desc}</p>
                    <p className="text-[11px] text-muted-foreground">{v.data} · {v.tipo === 'receber' ? 'Receber' : 'Pagar'}</p>
                  </div>
                </div>
                <span className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums ${v.tipo === 'receber' ? 'text-chart-5' : 'text-destructive'}`}>
                  {BRL(v.valor)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- showcase -- */

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'financeiro', label: 'Financeiro' },
]

export function ProductShowcase({ defaultTab = 'pipeline' }: { defaultTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(defaultTab)
  const reduce = useReducedMotion()

  const stagger = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: i * 0.05, duration: 0.4, ease: EASE_OUT },
        }

  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3 shadow-[0_30px_70px_-32px_rgba(20,35,58,0.3)] sm:p-4">
      {/* janela falsa + abas */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <div role="tablist" aria-label="Telas do produto" className="flex gap-1 rounded-full border border-border bg-card p-1">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="hidden w-12 sm:block" />
      </div>

      {/* tela */}
      <div role="tabpanel" className="rounded-xl bg-background p-3 sm:p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT }}
          >
            {tab === 'pipeline' ? (
              <PipelineScreen stagger={stagger} />
            ) : (
              <FinanceiroScreen stagger={stagger} reduce={!!reduce} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
