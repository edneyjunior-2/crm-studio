'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  Landmark, TrendingUp, TrendingDown, Wallet, AlertCircle,
  RefreshCw, Clock, DollarSign, AlertTriangle, Package,
  Users, CalendarMinus, CheckCircle2, XCircle,
  Scale, Bell, CalendarClock, FolderOpen,
} from 'lucide-react'
import { EASE_OUT } from './motion'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const BRLk = (v: number) => `R$ ${Math.round(v / 1000)}k`

type TabKey = 'pipeline' | 'financeiro' | 'estoque' | 'rh' | 'advocacia'

/* ---------------------------------------------------------------- pipeline -- */

const PIPELINE = [
  {
    stage: 'Qualificação', won: false,
    deals: [
      { titulo: 'Implantação do CRM', cliente: 'Metalúrgica Andrade', valor: 12400, prob: 35, sla: '6 dias' },
      { titulo: 'Consultoria fiscal', cliente: 'Verde Hortifruti', valor: 8900, prob: 25 },
    ],
  },
  {
    stage: 'Proposta', won: false,
    deals: [
      { titulo: 'Migração de ERP', cliente: 'Têxtil Bonfim', valor: 31500, prob: 60, sla: '4 dias' },
      { titulo: 'Plano anual', cliente: 'Clínica Vita', valor: 9800, prob: 50 },
    ],
  },
  {
    stage: 'Negociação', won: false,
    deals: [{ titulo: 'Expansão de licenças', cliente: 'Logística Recife', valor: 42000, prob: 75, adiado: true }],
  },
  {
    stage: 'Fechado Ganho', won: true,
    deals: [
      { titulo: 'Onboarding completo', cliente: 'Padaria Estrela', valor: 22000, periodicidade: 'Anual' },
      { titulo: 'Contrato mensal', cliente: 'Studio Alfa', valor: 18400, periodicidade: 'Mensal' },
    ],
  },
]

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
                    {'prob' in d && d.prob != null && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground tabular-nums">
                        {d.prob}%
                      </span>
                    )}
                  </div>
                  {('sla' in d || 'adiado' in d || 'periodicidade' in d) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {'sla' in d && d.sla && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          <Clock className="size-2.5" />{d.sla}
                        </span>
                      )}
                      {'adiado' in d && d.adiado && (
                        <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Prazo adiado
                        </span>
                      )}
                      {'periodicidade' in d && d.periodicidade && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-chart-5/30 bg-chart-5/10 px-2 py-0.5 text-[10px] font-medium text-chart-5">
                          <RefreshCw className="size-2.5" />{d.periodicidade}
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

/* --------------------------------------------------------------- financeiro -- */

const KPIS_FIN = [
  { label: 'Saldo em Caixa',       value: 248500, Icon: Landmark,     tone: 'text-chart-3 bg-chart-3/10' },
  { label: 'A Receber este mês',   value: 96200,  Icon: TrendingUp,   tone: 'text-chart-5 bg-chart-5/10' },
  { label: 'A Pagar este mês',     value: 54800,  Icon: TrendingDown, tone: 'text-destructive bg-destructive/10' },
  { label: 'Resultado Previsto',   value: 41400,  Icon: Wallet,       tone: 'text-accent bg-accent/10' },
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

const VENCENDO = [
  { desc: 'Mensalidade · Clínica Vita', tipo: 'receber' as const, valor: 2400, data: '14/06' },
  { desc: 'Aluguel do escritório',       tipo: 'pagar'   as const, valor: 6800, data: '16/06' },
  { desc: 'Comissão · João P.',          tipo: 'pagar'   as const, valor: 1760, data: '18/06' },
]

function FinanceiroScreen({ stagger, reduce }: { stagger: (i: number) => object; reduce: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS_FIN.map((k, i) => (
          <motion.div key={k.label} {...stagger(i)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
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
                  <motion.span className="w-1/2 rounded-t bg-chart-5"
                    style={{ height: `${(m.entradas / FLUXO_MAX) * 100}%`, transformOrigin: 'bottom' }}
                    initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ delay: reduce ? 0 : 0.15 + i * 0.05, duration: 0.5, ease: EASE_OUT }} />
                  <motion.span className="w-1/2 rounded-t bg-destructive/70"
                    style={{ height: `${(m.saidas / FLUXO_MAX) * 100}%`, transformOrigin: 'bottom' }}
                    initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ delay: reduce ? 0 : 0.2 + i * 0.05, duration: 0.5, ease: EASE_OUT }} />
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
              <motion.div key={v.desc} {...stagger(i + 1)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
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

/* ----------------------------------------------------------------- estoque -- */

const KPIS_EST = [
  { label: 'Valor em Estoque',  value: BRL(187340),  Icon: DollarSign,     tone: 'text-blue-600 bg-blue-50' },
  { label: 'Itens com Alerta',  value: '3 produtos', Icon: AlertTriangle,  tone: 'text-amber-600 bg-amber-50' },
  { label: 'Total de Produtos', value: '42 itens',   Icon: Package,        tone: 'text-violet-600 bg-violet-50' },
]

const PRODUTOS = [
  { nome: 'Cabo HDMI 2m',         unidade: 'un',  saldo: 82,  min: 20, custo: 18.90,  status: 'ok'    },
  { nome: 'Teclado Mecânico USB', unidade: 'un',  saldo: 6,   min: 10, custo: 189.00, status: 'baixo' },
  { nome: 'Papel A4 (resma)',      unidade: 'rs',  saldo: 120, min: 30, custo: 24.50,  status: 'ok'    },
  { nome: 'Mouse Sem Fio',        unidade: 'un',  saldo: 3,   min: 8,  custo: 79.90,  status: 'baixo' },
  { nome: 'Cartucho HP 664',      unidade: 'cx',  saldo: 14,  min: 5,  custo: 42.00,  status: 'ok'    },
]

const MOVS = [
  { tipo: 'entrada' as const, produto: 'Papel A4 (resma)',      qtd: 50, data: '16/06' },
  { tipo: 'saida'   as const, produto: 'Teclado Mecânico USB',  qtd: 2,  data: '15/06' },
  { tipo: 'entrada' as const, produto: 'Cabo HDMI 2m',          qtd: 30, data: '14/06' },
]

function EstoqueScreen({ stagger }: { stagger: (i: number) => object }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {KPIS_EST.map((k, i) => (
          <motion.div key={k.label} {...stagger(i)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${k.tone}`}>
              <k.Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{k.label}</p>
              <p className="text-[15px] font-semibold tabular-nums">{k.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {/* Tabela de produtos */}
        <div className="rounded-xl border border-border bg-card lg:col-span-3">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-[13px] font-semibold">Produtos em estoque</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Produto</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground">Saldo</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground">Custo</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {PRODUTOS.map((p, i) => (
                <motion.tr key={p.nome} {...stagger(i + 1)}
                  className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="text-[13px] font-medium">{p.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{p.unidade}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums font-medium">
                    {p.saldo}
                    {p.saldo < p.min && (
                      <span className="ml-1 text-[10px] text-muted-foreground">/ {p.min} mín</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-muted-foreground">
                    {BRL(p.custo)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {p.status === 'ok' ? (
                      <CheckCircle2 className="mx-auto size-4 text-chart-5" />
                    ) : (
                      <AlertTriangle className="mx-auto size-4 text-amber-500" />
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Últimas movimentações */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h4 className="mb-3 text-[13px] font-semibold">Últimas movimentações</h4>
          <div className="flex flex-col gap-2">
            {MOVS.map((m, i) => (
              <motion.div key={`${m.produto}-${i}`} {...stagger(i + 1)}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                  m.tipo === 'entrada' ? 'bg-chart-5/10 text-chart-5' : 'bg-destructive/10 text-destructive'
                }`}>
                  {m.tipo === 'entrada' ? '+' : '−'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{m.produto}</p>
                  <p className="text-[11px] text-muted-foreground">{m.data} · {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</p>
                </div>
                <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                  m.tipo === 'entrada' ? 'text-chart-5' : 'text-destructive'
                }`}>
                  {m.tipo === 'entrada' ? '+' : '−'}{m.qtd} un
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- rh -- */

const KPIS_RH = [
  { label: 'Colaboradores',   value: '12 ativos',      Icon: Users,         tone: 'text-chart-3 bg-chart-3/10' },
  { label: 'Folha do mês',    value: BRL(74200),        Icon: DollarSign,    tone: 'text-chart-5 bg-chart-5/10' },
  { label: 'Ausências/mês',   value: '3 registradas',  Icon: CalendarMinus, tone: 'text-amber-600 bg-amber-50' },
]

const COLABORADORES = [
  { nome: 'Ana Beatriz Costa',  cargo: 'Vendedora',        status: 'ativo',   salario: 3800 },
  { nome: 'Carlos Mendonça',    cargo: 'Gerente Comercial', status: 'ativo',  salario: 7200 },
  { nome: 'Fernanda Lima',      cargo: 'Assistente Adm.',   status: 'ativo',  salario: 2600 },
  { nome: 'João Paulo Ramos',   cargo: 'Representante',     status: 'ferias', salario: 4100 },
  { nome: 'Patrícia Gomes',     cargo: 'Financeiro',        status: 'ativo',  salario: 3950 },
]

const AUSENCIAS = [
  { nome: 'João Paulo Ramos', tipo: 'Férias',   inicio: '10/06', fim: '28/06' },
  { nome: 'Ana Beatriz Costa', tipo: 'Médica',  inicio: '17/06', fim: '17/06' },
]

function RhScreen({ stagger }: { stagger: (i: number) => object }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {KPIS_RH.map((k, i) => (
          <motion.div key={k.label} {...stagger(i)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${k.tone}`}>
              <k.Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{k.label}</p>
              <p className="text-[15px] font-semibold tabular-nums">{k.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {/* Tabela de colaboradores */}
        <div className="rounded-xl border border-border bg-card lg:col-span-3">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-[13px] font-semibold">Colaboradores</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Nome</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Cargo</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground">Salário</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {COLABORADORES.map((c, i) => (
                <motion.tr key={c.nome} {...stagger(i + 1)}
                  className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                        {c.nome[0]}
                      </div>
                      <p className="text-[13px] font-medium truncate">{c.nome}</p>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{c.cargo}</td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums font-medium">{BRL(c.salario)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      c.status === 'ativo' ? 'bg-chart-5/10 text-chart-5' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {c.status === 'ativo' ? 'Ativo' : 'Férias'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ausências */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <CalendarMinus className="size-4 text-accent" />
            <h4 className="text-[13px] font-semibold">Ausências no mês</h4>
          </div>
          <div className="flex flex-col gap-2">
            {AUSENCIAS.map((a, i) => (
              <motion.div key={`${a.nome}-${i}`} {...stagger(i + 1)}
                className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                <XCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{a.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{a.tipo} · {a.inicio}{a.inicio !== a.fim ? ` → ${a.fim}` : ''}</p>
                </div>
              </motion.div>
            ))}
            <div className="mt-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Nenhuma outra ausência registrada</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- advocacia -- */

const KPIS_ADV = [
  { label: 'Total de processos',     value: '113', Icon: Scale,      tone: 'text-foreground bg-muted' },
  { label: 'Movimentações novas',    value: '6',   Icon: Bell,       tone: 'text-amber-600 bg-amber-50' },
  { label: 'Em trânsito no DataJud', value: '108', Icon: RefreshCw,  tone: 'text-blue-600 bg-blue-50' },
  { label: 'Sem dados DataJud',      value: '5',   Icon: FolderOpen, tone: 'text-muted-foreground bg-muted' },
]

const PRAZOS_ADV = [
  { data: '19/07', badge: 'Vencido há 2 dias', urgente: true,  desc: 'Audiência de instrução e julgamento', num: '0131333-52.2026.8.05.0001' },
  { data: '20/07', badge: 'Vencido há 1 dia',  urgente: true,  desc: 'Prazo para contestação',               num: '0121239-45.2026.8.05.0001' },
  { data: '27/07', badge: '6 dias',            urgente: false, desc: 'Audiência de conciliação',              num: '0145219-21.2026.8.05.0001' },
]

const AREA_ADV = [
  { label: 'Cível',          valor: 68, cor: 'bg-blue-500' },
  { label: 'Tributário',     valor: 33, cor: 'bg-amber-500' },
  { label: 'Precatório',     valor: 5,  cor: 'bg-violet-500' },
  { label: 'Previdenciário', valor: 2,  cor: 'bg-chart-5' },
]
const AREA_MAX = Math.max(...AREA_ADV.map((a) => a.valor))

const PROCESSOS_ADV = [
  { tribunal: 'TJBA', cliente: 'Maria Aparecida Souza',        num: '1000001-00.2026.8.05.0001', assunto: 'ITBI — Imposto de Transmissão' },
  { tribunal: 'TJBA', cliente: 'Construtora Horizonte Ltda',   num: '1000002-00.2026.8.05.0001', assunto: 'Indenização por danos materiais em obra' },
  { tribunal: 'TRT5', cliente: 'João Batista Ferreira',        num: '1000003-00.2026.8.05.0001', assunto: 'Reclamação trabalhista — verbas rescisórias' },
]

function AdvocaciaScreen({ stagger, reduce }: { stagger: (i: number) => object; reduce: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS_ADV.map((k, i) => (
          <motion.div key={k.label} {...stagger(i)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${k.tone}`}>
              <k.Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{k.label}</p>
              <p className="text-[15px] font-semibold tabular-nums">{k.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Prazos a vencer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="size-4 text-amber-600" />
          <h4 className="text-[13px] font-semibold">Prazos a vencer</h4>
          <span className="ml-auto text-[11px] text-muted-foreground">próximos 30 dias</span>
        </div>
        <div className="flex flex-col gap-2">
          {PRAZOS_ADV.map((p, i) => (
            <motion.div key={p.desc} {...stagger(i)} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-[11px] text-muted-foreground">{p.data}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  p.urgente ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                }`}>
                  {p.badge}
                </span>
                <span className={`truncate text-[12px] font-medium ${p.urgente ? 'text-destructive' : 'text-foreground'}`}>
                  {p.desc}
                </span>
              </div>
              <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:block">{p.num}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Processos por área */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 text-[13px] font-semibold">Processos por área</h4>
          <div className="flex flex-col gap-2.5">
            {AREA_ADV.map((a, i) => (
              <div key={a.label} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 shrink-0 truncate text-muted-foreground">{a.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={`h-full rounded-full ${a.cor}`}
                    style={{ width: `${(a.valor / AREA_MAX) * 100}%`, transformOrigin: 'left' }}
                    initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                    transition={{ delay: reduce ? 0 : 0.1 + i * 0.06, duration: 0.5, ease: EASE_OUT }}
                  />
                </div>
                <span className="w-5 shrink-0 text-right font-semibold tabular-nums">{a.valor}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Processos por status */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 text-[13px] font-semibold">Processos por status</h4>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-20 shrink-0 text-chart-5">Em trânsito</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-chart-5"
                style={{ transformOrigin: 'left' }}
                initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ delay: reduce ? 0 : 0.1, duration: 0.5, ease: EASE_OUT }}
              />
            </div>
            <span className="w-5 shrink-0 text-right font-semibold tabular-nums">113</span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-chart-5/10 px-2.5 py-1 text-[10px] font-medium text-chart-5">
            <span className="size-1.5 rounded-full bg-chart-5" /> Em trânsito: 113
          </span>
        </div>
      </div>

      {/* Cards de processo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROCESSOS_ADV.map((p, i) => (
          <motion.div key={p.num} {...stagger(i)}
            className="rounded-xl border border-border bg-card p-3.5">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold">
                <Scale className="size-2.5" />{p.tribunal}
              </span>
              <span className="rounded-full bg-chart-5/10 px-2 py-0.5 text-[10px] font-medium text-chart-5">Em trânsito</span>
            </div>
            <p className="truncate text-[12px] font-semibold">{p.cliente}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{p.num}</p>
            <p className="truncate text-[11px] text-muted-foreground">{p.assunto}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- showcase -- */

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pipeline',   label: 'Pipeline' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'advocacia',  label: 'Advocacia' },
  { key: 'estoque',    label: 'Estoque' },
  { key: 'rh',         label: 'RH' },
]

export function ProductShowcase({ defaultTab = 'pipeline' }: { defaultTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(defaultTab)
  const reduce = useReducedMotion()

  const stagger = (i: number) =>
    reduce ? {} : {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { delay: i * 0.05, duration: 0.4, ease: EASE_OUT },
    }

  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3 shadow-[0_30px_70px_-32px_rgba(20,35,58,0.3)] sm:p-4">
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
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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

      <div role="tabpanel" className="rounded-xl bg-background p-3 sm:p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT }}
          >
            {tab === 'pipeline'   && <PipelineScreen stagger={stagger} />}
            {tab === 'financeiro' && <FinanceiroScreen stagger={stagger} reduce={!!reduce} />}
            {tab === 'advocacia'  && <AdvocaciaScreen stagger={stagger} reduce={!!reduce} />}
            {tab === 'estoque'    && <EstoqueScreen stagger={stagger} />}
            {tab === 'rh'         && <RhScreen stagger={stagger} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
