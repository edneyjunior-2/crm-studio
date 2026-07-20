'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  LayoutDashboard,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Settings,
  LogOut,
  ChevronRight,
  Handshake,
  Landmark,
  Activity,
  Zap,
  UserCircle,
  FileText,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  Boxes,
  IdCard,
  Scale,
  MessagesSquare,
  UserCheck,
  HardHat,
  Calculator,
  Sparkles,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import type { Modulo } from '@/lib/modulos'
import { logout } from '@/app/(auth)/login/actions'
import { contarConversasNaoLidas } from '@/app/(crm)/atendimento/atendimento-actions'
import { BugReportButton } from './bug-report-button'
import { ultimaAtualizacaoVisivel } from '@/lib/changelog'

/** Intervalo do polling do badge de não lidas (WhatsApp) — entre 15s e 30s. */
const POLL_NAO_LIDAS_MS = 20_000

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: Profile['role'][]
  /** Slug do módulo de gating. Ausente → item de infra (sempre visível). */
  modulo?: Modulo
  isSubItem?: boolean
  exactMatch?: boolean
  parentHref?: string
  tourSlug?: string
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    tourSlug: 'dashboard',
    // sem modulo → infra, sempre visível para papéis internos.
    // Parceiro (externo) é a exceção: dashboard mostra pipeline/financeiro do
    // escritório inteiro — fora do escopo dele. A página também redireciona
    // parceiro pra /pipeline por segurança; isto só esconde o item do menu.
    roles: ['admin', 'socio', 'comercial'],
  },
  {
    href: '/atendimento',
    label: 'WhatsApp',
    icon: MessagesSquare,
    modulo: 'atendimentos',
    tourSlug: 'atendimento',
  },
  {
    href: '/solucoes',
    label: 'Soluções',
    icon: Package,
    modulo: 'solucoes',
    tourSlug: 'solucoes',
  },
  {
    href: '/parceiros',
    label: 'Parceiros',
    icon: Handshake,
    modulo: 'parceiros',
    tourSlug: 'parceiros',
  },
  {
    href: '/clientes',
    label: 'Clientes',
    icon: Users,
    modulo: 'clientes',
    tourSlug: 'clientes',
  },
  {
    href: '/pipeline',
    label: 'Pipeline',
    icon: TrendingUp,
    modulo: 'pipeline',
    exactMatch: true,
    tourSlug: 'pipeline',
  },
  {
    href: '/pipeline/historico-perdidos',
    label: 'Histórico',
    icon: TrendingDown,
    modulo: 'pipeline',
    isSubItem: true,
    parentHref: '/pipeline',
  },
  {
    href: '/onboarding',
    label: 'Onboarding',
    icon: GitBranch,
    modulo: 'fluxos',
    tourSlug: 'onboarding',
  },
  {
    href: '/calendario',
    label: 'Calendário',
    icon: CalendarDays,
    modulo: 'calendario',
    tourSlug: 'calendario',
  },
  {
    href: '/financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    modulo: 'financeiro',
    exactMatch: true,
    tourSlug: 'financeiro',
  },
  {
    href: '/financeiro/dashboard',
    label: 'Saúde Financeira',
    icon: Activity,
    modulo: 'financeiro',
    roles: ['admin', 'socio'],
    isSubItem: true,
    parentHref: '/financeiro',
  },
  {
    href: '/financeiro/bancos',
    label: 'Bancos',
    icon: Landmark,
    modulo: 'financeiro',
    roles: ['admin', 'socio'],
    isSubItem: true,
    parentHref: '/financeiro',
  },
  {
    href: '/processos',
    label: 'Processos',
    icon: Scale,
    modulo: 'processos',
    exactMatch: true,
    tourSlug: 'processos',
  },
  {
    href: '/processos/responsabilidades',
    label: 'Responsabilidades',
    icon: UserCheck,
    modulo: 'processos',
    isSubItem: true,
    parentHref: '/processos',
  },
  {
    href: '/obras',
    label: 'Obras',
    icon: HardHat,
    modulo: 'obras',
    exactMatch: true,
    tourSlug: 'obras',
  },
  {
    href: '/obras/orcamentos',
    label: 'Orçamentos',
    icon: Calculator,
    modulo: 'obras',
    isSubItem: true,
    parentHref: '/obras',
  },
  {
    href: '/frete',
    label: 'Frete e Logística',
    icon: Truck,
    modulo: 'frete',
    exactMatch: true,
    tourSlug: 'frete',
  },
  {
    href: '/frete/cotacoes',
    label: 'Cotações',
    icon: Calculator,
    modulo: 'frete',
    isSubItem: true,
    parentHref: '/frete',
  },
  {
    href: '/frete/veiculos',
    label: 'Veículos',
    icon: Truck,
    modulo: 'frete',
    isSubItem: true,
    parentHref: '/frete',
  },
  {
    href: '/frete/motoristas',
    label: 'Motoristas',
    icon: IdCard,
    modulo: 'frete',
    isSubItem: true,
    parentHref: '/frete',
  },
  {
    href: '/contratos',
    label: 'Contratos',
    icon: FileText,
    modulo: 'contratos',
    tourSlug: 'contratos',
  },
  {
    href: '/estoque',
    label: 'Estoque',
    icon: Boxes,
    modulo: 'estoque',
    roles: ['admin', 'socio'],
    tourSlug: 'estoque',
  },
  {
    href: '/rh',
    label: 'RH',
    icon: IdCard,
    modulo: 'rh',
    roles: ['admin'],
    tourSlug: 'rh',
  },
  {
    href: '/automacoes',
    label: 'Automações',
    icon: Zap,
    modulo: 'automacoes',
    roles: ['admin'],
    tourSlug: 'automacoes',
  },
]

const roleLabel: Record<Profile['role'], string> = {
  admin: 'Administrador',
  socio: 'Sócio',
  comercial: 'Comercial',
  parceiro: 'Parceiro',
}

interface SidebarProps {
  profile: Profile
  /** Array de slugs de módulos efetivos para esta empresa (calculado no layout). */
  modulosAtivos: string[]
  mobileOpen?: boolean
  onMobileClose?: () => void
  empresaId?: string | null
  empresaNome?: string | null
  /** Contagem inicial de conversas não lidas (badge do item "WhatsApp"), vinda do server. */
  unreadWhatsappInicial?: number
  /** Signed URL da foto de perfil do usuário logado. Null/undefined → fallback de iniciais. */
  avatarUrl?: string | null
}

export function Sidebar({ profile, modulosAtivos, mobileOpen, onMobileClose, empresaId, empresaNome, unreadWhatsappInicial, avatarUrl }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const prefersReduced = useReducedMotion()
  const [temNovidade, setTemNovidade] = useState(false)
  const [unreadWhatsapp, setUnreadWhatsapp] = useState(unreadWhatsappInicial ?? 0)

  // Polling leve do badge de não lidas — só enquanto o módulo 'atendimentos'
  // estiver ativo pra este usuário (mesmo gating que decide se o item aparece).
  // Falha num poll individual mantém o último valor conhecido (AC9): sem
  // toast/erro, é um indicador passivo, tenta de novo no próximo intervalo.
  useEffect(() => {
    if (!modulosAtivos.includes('atendimentos')) return
    let cancelado = false
    const id = setInterval(() => {
      contarConversasNaoLidas()
        .then((n) => {
          if (!cancelado) setUnreadWhatsapp(n)
        })
        .catch(() => {
          // silencioso de propósito: mantém o valor anterior
        })
    }, POLL_NAO_LIDAS_MS)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [modulosAtivos])

  useEffect(() => {
    const ultimaVisivel = ultimaAtualizacaoVisivel(modulosAtivos)
    function verificar() {
      setTemNovidade(
        ultimaVisivel !== '' &&
          localStorage.getItem('atualizacoes_vista') !== ultimaVisivel
      )
    }
    verificar()
    // Reage quando a page de Atualizações marca como visto (mesma aba)
    window.addEventListener('atualizacoes-vista', verificar)
    // Reage quando outra aba/janela atualiza o localStorage
    window.addEventListener('storage', verificar)
    return () => {
      window.removeEventListener('atualizacoes-vista', verificar)
      window.removeEventListener('storage', verificar)
    }
  }, [modulosAtivos])

  const isParceiro = profile.role === 'parceiro'

  const visibleItems = navItems.filter((item) => {
    // Filtro de role (AND com filtro de módulo)
    if (item.roles && !item.roles.includes(profile.role)) return false
    // Parceiro é portal externo: vê só os itens de topo das abas liberadas.
    // Nenhum sub-item (histórico de perdidos, responsabilidades) faz sentido
    // pra ele e vários batem em telas que a RLS dele nega.
    if (isParceiro && item.isSubItem) return false
    // Sub-itens só aparecem quando o pai está ativo
    if (item.parentHref && !pathname.startsWith(item.parentHref)) return false
    // Pro parceiro, "Financeiro" leva a /financeiro/comissoes, que é gateada
    // por requireModulo('comissoes') — e o plano starter não tem 'comissoes'.
    // Exige os DOIS: 'financeiro' é o módulo do próprio item (e o que o admin
    // esconde via modulos_ocultos), 'comissoes' é o do destino. Checar só um
    // deixaria o parceiro com uma aba que todo o resto do time já perdeu.
    if (isParceiro && item.href === '/financeiro') {
      return modulosAtivos.includes('financeiro') && modulosAtivos.includes('comissoes')
    }
    // Filtro de módulo: item sem módulo → infra (sempre aparece)
    if (item.modulo && !modulosAtivos.includes(item.modulo)) return false
    return true
  })

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          'relative flex flex-col border-r border-border bg-sidebar transition-all duration-300',
          'fixed inset-y-0 left-0 z-40 lg:static lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'w-14' : 'w-60'
        )}
      >
      {/* Header */}
      <div className={cn(
        'flex items-center border-b border-border',
        collapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'
      )}>
        {!collapsed && (
          <img
            src="/brand/CRM-Studio-wordmark-white.svg"
            alt="CRM Studio"
            className="h-5 w-auto"
          />
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="rounded-lg p-1.5 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {visibleItems.map((item) => {
          // /financeiro é a visão da empresa inteira — o parceiro nunca entra
          // lá (a página também o redireciona). A aba dele são as comissões.
          const href =
            isParceiro && item.href === '/financeiro'
              ? '/financeiro/comissoes'
              : item.href

          const isActive = item.exactMatch
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={href}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onMobileClose?.()}
              {...(item.tourSlug ? { 'data-tour': item.tourSlug } : {})}
              className={cn(
                'group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-200',
                collapsed
                  ? 'justify-center px-0 py-2'
                  : item.isSubItem
                    ? 'gap-2.5 px-3 py-1.5 pl-8'
                    : 'gap-2.5 px-3 py-2',
                isActive
                  ? 'text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              )}
            >
              {isActive && !prefersReduced && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  style={{ zIndex: 0 }}
                />
              )}
              {isActive && prefersReduced && (
                <span className="absolute inset-0 rounded-lg bg-sidebar-accent" />
              )}
              {/* Wrapper relativo para o badge de não lidas (item WhatsApp) */}
              <span className="relative">
                <Icon
                  className={cn(
                    'relative shrink-0 transition-colors duration-200',
                    item.isSubItem && !collapsed ? 'size-3.5' : 'size-4',
                    isActive
                      ? 'text-sidebar-primary'
                      : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
                  )}
                />
                {item.href === '/atendimento' && unreadWhatsapp > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-[3px] text-[9px] font-semibold leading-none text-white ring-1 ring-sidebar">
                    {unreadWhatsapp > 9 ? '9+' : unreadWhatsapp}
                  </span>
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="relative">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="relative ml-auto size-3.5 text-sidebar-primary" />
                  )}
                </>
              )}
            </Link>
          )
        })}

        {/* Bug report — no final da nav, antes da linha divisória */}
        <BugReportButton
          collapsed={collapsed}
          empresaId={empresaId}
          empresaNome={empresaNome}
          userName={profile.full_name}
          userRole={profile.role}
        />
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-foreground">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL do Storage, não é um asset estático
                <img src={avatarUrl} alt={profile.full_name} className="size-full object-cover" />
              ) : (
                profile.full_name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?'
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {profile.full_name}
              </p>
              <p className="text-xs text-sidebar-foreground/60">
                {profile.cargo ?? roleLabel[profile.role]}
              </p>
            </div>
          </div>
        )}

        {/* Atualizações */}
        {(() => {
          const isAtivActive = pathname === '/atualizacoes' || pathname.startsWith('/atualizacoes/')
          return (
            <Link
              href="/atualizacoes"
              title={collapsed ? 'Atualizações' : undefined}
              onClick={() => onMobileClose?.()}
              className={cn(
                'group relative flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                collapsed ? 'justify-center px-0' : 'gap-2.5',
                isAtivActive
                  ? 'text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              )}
            >
              {isAtivActive && !prefersReduced && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  style={{ zIndex: 0 }}
                />
              )}
              {isAtivActive && prefersReduced && (
                <span className="absolute inset-0 rounded-lg bg-sidebar-accent" />
              )}
              {/* Wrapper relativo para o dot de novidade */}
              <span className="relative">
                <Sparkles className={cn(
                  'relative size-4 shrink-0 transition-colors',
                  isAtivActive
                    ? 'text-sidebar-primary'
                    : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
                )} />
                {temNovidade && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red-500 ring-1 ring-sidebar" />
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="relative">Atualizações</span>
                  {isAtivActive && (
                    <ChevronRight className="relative ml-auto size-3.5 text-sidebar-primary" />
                  )}
                </>
              )}
            </Link>
          )
        })()}

        {/* Minha Conta */}
        {(() => {
          const isContaActive = pathname === '/minha-conta' || pathname.startsWith('/minha-conta/')
          return (
            <Link
              href="/minha-conta"
              title={collapsed ? 'Minha Conta' : undefined}
              onClick={() => onMobileClose?.()}
              className={cn(
                'group relative flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                collapsed ? 'justify-center px-0' : 'gap-2.5',
                isContaActive
                  ? 'text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              )}
            >
              {isContaActive && !prefersReduced && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  style={{ zIndex: 0 }}
                />
              )}
              {isContaActive && prefersReduced && (
                <span className="absolute inset-0 rounded-lg bg-sidebar-accent" />
              )}
              <UserCircle className={cn(
                'relative size-4 shrink-0 transition-colors',
                isContaActive
                  ? 'text-sidebar-primary'
                  : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
              )} />
              {!collapsed && (
                <>
                  <span className="relative">Minha Conta</span>
                  {isContaActive && (
                    <ChevronRight className="relative ml-auto size-3.5 text-sidebar-primary" />
                  )}
                </>
              )}
            </Link>
          )
        })()}

        {/* Configurações (admin only) */}
        {profile.role === 'admin' && (() => {
          const isConfigActive = pathname === '/configuracoes' || pathname.startsWith('/configuracoes/')
          return (
            <Link
              href="/configuracoes"
              title={collapsed ? 'Configurações' : undefined}
              onClick={() => onMobileClose?.()}
              className={cn(
                'group relative flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                collapsed ? 'justify-center px-0' : 'gap-2.5',
                isConfigActive
                  ? 'text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              )}
            >
              {isConfigActive && !prefersReduced && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  style={{ zIndex: 0 }}
                />
              )}
              {isConfigActive && prefersReduced && (
                <span className="absolute inset-0 rounded-lg bg-sidebar-accent" />
              )}
              <Settings className={cn(
                'relative size-4 shrink-0 transition-colors',
                isConfigActive
                  ? 'text-sidebar-primary'
                  : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
              )} />
              {!collapsed && (
                <>
                  <span className="relative">Configurações</span>
                  {isConfigActive && (
                    <ChevronRight className="relative ml-auto size-3.5 text-sidebar-primary" />
                  )}
                </>
              )}
            </Link>
          )
        })()}

        {/* Logout */}
        <form action={logout}>
          <button
            type="submit"
            title={collapsed ? 'Sair' : undefined}
            className={cn(
              'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive',
              collapsed ? 'justify-center px-0' : 'gap-2.5'
            )}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && 'Sair'}
          </button>
        </form>

      </div>
    </aside>
    </>
  )
}
