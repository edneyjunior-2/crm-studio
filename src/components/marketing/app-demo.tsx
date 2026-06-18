'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  LayoutDashboard, TrendingUp, DollarSign, Users,
  CalendarDays, Settings, ChevronRight, FileText,
} from 'lucide-react'

const TELAS = [
  { slug: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { slug: 'pipeline',  label: 'Pipeline',  icon: TrendingUp },
  { slug: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { slug: 'clientes',  label: 'Clientes',  icon: Users },
  { slug: 'calendario', label: 'Calendário', icon: CalendarDays },
  { slug: 'contratos', label: 'Contratos', icon: FileText },
]

function DashboardScreen() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">Boa tarde, Alex</p>
      <p className="text-2xl font-bold text-[#16181d]">R$ 84.320</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Clientes', value: '47', color: 'bg-[#14233a]/8' },
          { label: 'Negócios', value: '12', color: 'bg-[#e8915b]/10' },
          { label: 'A receber', value: '8', color: 'bg-emerald-50' },
        ].map((card) => (
          <div key={card.label} className={`rounded-lg ${card.color} px-2.5 py-2.5`}>
            <p className="text-[9px] text-[#9ca3af]">{card.label}</p>
            <p className="text-base font-bold text-[#16181d]">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-1 rounded-lg bg-[#f9f8f5] p-2.5">
        <p className="mb-2 text-[9px] font-semibold text-[#9ca3af]">PIPELINE DO MÊS</p>
        <div className="flex items-end gap-1 h-12">
          {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: `${h}%`, originY: 1 }}
              className="flex-1 rounded-sm bg-[#14233a]/20"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PipelineScreen() {
  const estagios = [
    { label: 'Prospecção', color: 'bg-slate-100', items: ['Empresa Alpha', 'Grupo Beta'] },
    { label: 'Proposta', color: 'bg-violet-50', items: ['Construtora Silva'] },
    { label: 'Negociação', color: 'bg-amber-50', items: ['Rede Varejo X', 'Holding Y'] },
  ]
  return (
    <div className="flex gap-2 p-3 overflow-hidden h-full">
      {estagios.map((est) => (
        <div key={est.label} className="flex-1 flex flex-col gap-1.5 min-w-0">
          <p className="text-[9px] font-semibold text-[#9ca3af] uppercase tracking-wide truncate">{est.label}</p>
          {est.items.map((item) => (
            <div key={item} className={`rounded-lg ${est.color} px-2 py-2`}>
              <p className="text-[9px] font-medium text-[#16181d] truncate">{item}</p>
              <p className="text-[8px] text-[#9ca3af] mt-0.5">R$ {(Math.random() * 50 + 10).toFixed(0)}k</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function FinanceiroScreen() {
  const contas = [
    { desc: 'Fornecedor ABC', valor: 'R$ 3.200', status: 'pago', cor: 'text-emerald-600 bg-emerald-50' },
    { desc: 'Aluguel sede', valor: 'R$ 4.800', status: 'pendente', cor: 'text-amber-600 bg-amber-50' },
    { desc: 'Comissão Mar', valor: 'R$ 1.560', status: 'atrasado', cor: 'text-red-600 bg-red-50' },
    { desc: 'Software CRM', valor: 'R$ 449', status: 'pago', cor: 'text-emerald-600 bg-emerald-50' },
  ]
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div className="rounded-lg bg-emerald-50 px-3 py-2">
          <p className="text-[9px] text-[#9ca3af]">A receber</p>
          <p className="text-sm font-bold text-emerald-700">R$ 28.400</p>
        </div>
        <div className="rounded-lg bg-red-50 px-3 py-2">
          <p className="text-[9px] text-[#9ca3af]">A pagar</p>
          <p className="text-sm font-bold text-red-600">R$ 11.200</p>
        </div>
      </div>
      {contas.map((c) => (
        <div key={c.desc} className="flex items-center justify-between rounded-lg bg-[#f9f8f5] px-2.5 py-2">
          <p className="text-[9px] font-medium text-[#16181d] truncate flex-1">{c.desc}</p>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            <p className="text-[9px] font-semibold text-[#16181d]">{c.valor}</p>
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${c.cor}`}>{c.status}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ClientesScreen() {
  const clientes = ['Construtora Silva Ltda', 'Grupo Medeiros', 'Rede Farma Sul', 'Holding Aliança']
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-2 mb-1">
        <div className="h-2 w-2 rounded-full bg-[#e5e7eb]" />
        <p className="text-[9px] text-[#9ca3af]">Buscar cliente...</p>
      </div>
      {clientes.map((c, i) => (
        <div key={c} className="flex items-center gap-2 rounded-lg bg-[#f9f8f5] px-2.5 py-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#14233a]/10">
            <span className="text-[8px] font-bold text-[#14233a]">{c[0]}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium text-[#16181d] truncate">{c}</p>
            <p className="text-[8px] text-[#9ca3af]">{3 - i} negócio{3 - i !== 1 ? 's' : ''} ativo{3 - i !== 1 ? 's' : ''}</p>
          </div>
          <ChevronRight className="size-2.5 text-[#9ca3af] shrink-0" />
        </div>
      ))}
    </div>
  )
}

function CalendarioScreen() {
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
  const eventos = [
    { dia: 1, hora: '09:00', titulo: 'Reunião Alpha', color: 'bg-[#14233a]/10 text-[#14233a]' },
    { dia: 2, hora: '14:00', titulo: 'Demo produto', color: 'bg-[#e8915b]/15 text-[#e8915b]' },
    { dia: 3, hora: '10:30', titulo: 'Proposta Beta', color: 'bg-emerald-100 text-emerald-700' },
    { dia: 4, hora: '16:00', titulo: 'Follow-up', color: 'bg-violet-100 text-violet-700' },
  ]
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="grid grid-cols-5 gap-1 mb-1">
        {dias.map((d) => (
          <div key={d} className="rounded bg-[#f9f8f5] py-1.5 text-center">
            <p className="text-[8px] font-semibold text-[#9ca3af]">{d}</p>
            <p className="text-[11px] font-bold text-[#16181d]">{Math.floor(Math.random() * 5) + 15}</p>
          </div>
        ))}
      </div>
      {eventos.map((ev) => (
        <div key={ev.titulo} className={`rounded-lg px-2.5 py-1.5 ${ev.color}`}>
          <p className="text-[8px] opacity-70">{ev.hora}</p>
          <p className="text-[9px] font-semibold">{ev.titulo}</p>
        </div>
      ))}
    </div>
  )
}

function ContratosScreen() {
  const contratos = [
    { nome: 'Construtora Silva', status: 'Ativo', vence: 'Dez 2025' },
    { nome: 'Grupo Medeiros', status: 'Ativo', vence: 'Mar 2026' },
    { nome: 'Rede Farma Sul', status: 'Vencendo', vence: 'Jul 2025' },
  ]
  return (
    <div className="flex flex-col gap-2 p-3">
      {contratos.map((c) => (
        <div key={c.nome} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold text-[#16181d]">{c.nome}</p>
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
              c.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>{c.status}</span>
          </div>
          <p className="text-[8px] text-[#9ca3af] mt-0.5">Vence em {c.vence}</p>
        </div>
      ))}
    </div>
  )
}

const SCREENS: Record<string, React.ReactNode> = {
  dashboard: <DashboardScreen />,
  pipeline: <PipelineScreen />,
  financeiro: <FinanceiroScreen />,
  clientes: <ClientesScreen />,
  calendario: <CalendarioScreen />,
  contratos: <ContratosScreen />,
}

export function AppDemo() {
  const [ativo, setAtivo] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setAtivo((v) => (v + 1) % TELAS.length), 2600)
    return () => clearInterval(id)
  }, [reduce])

  const telaNome = TELAS[ativo].slug

  return (
    <div className="relative w-full max-w-[460px]">
      {/* Glow de fundo */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-accent/20 via-transparent to-[#14233a]/10 blur-2xl" />

      {/* Janela do app */}
      <div className="relative overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_24px_64px_rgba(22,24,29,0.12)]">
        {/* Barra de título */}
        <div className="flex items-center gap-1.5 border-b border-[#f3f4f6] bg-[#f9f8f5] px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="mx-auto text-[10px] font-semibold text-[#9ca3af]">app.crmstudio.com.br</span>
        </div>

        {/* Layout app */}
        <div className="flex" style={{ height: 320 }}>
          {/* Sidebar */}
          <div className="flex w-[110px] shrink-0 flex-col border-r border-[#f3f4f6] bg-[#14233a] py-3">
            <p className="mb-3 px-3 font-bold text-[11px] text-white/90 tracking-tight">
              CRM Studio<span className="text-[#e8915b]">.</span>
            </p>
            {TELAS.map((tela, i) => {
              const Icon = tela.icon
              const isAtivo = i === ativo
              return (
                <button
                  key={tela.slug}
                  type="button"
                  onClick={() => setAtivo(i)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-left transition-colors ${
                    isAtivo ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {isAtivo && (
                    <motion.span
                      layoutId="sidebar-ativo"
                      className="absolute inset-0 rounded-md bg-white/10"
                      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                    />
                  )}
                  <Icon className={`relative size-3 shrink-0 ${isAtivo ? 'text-[#e8915b]' : ''}`} />
                  <span className="relative text-[9px] font-medium">{tela.label}</span>
                </button>
              )
            })}
            <div className="mt-auto px-3">
              <button type="button" className="flex items-center gap-1.5 text-white/30 hover:text-white/50 transition-colors">
                <Settings className="size-3" />
                <span className="text-[9px]">Config.</span>
              </button>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="relative flex-1 overflow-hidden bg-[#fafaf9]">
            <AnimatePresence mode="wait">
              <motion.div
                key={telaNome}
                initial={reduce ? {} : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? {} : { opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 overflow-hidden"
              >
                {SCREENS[telaNome]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Barra de progresso */}
        {!reduce && (
          <div className="h-0.5 bg-[#f3f4f6]">
            <motion.div
              key={ativo}
              className="h-full bg-[#e8915b]"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.6, ease: 'linear' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
