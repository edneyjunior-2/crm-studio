'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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
  Zap,
  UserCircle,
  FileText,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  Boxes,
  IdCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import type { Modulo } from '@/lib/modulos'
import { logout } from '@/app/(auth)/login/actions'

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
    // sem modulo → infra, sempre visível
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
    label: 'Hist. Perdidos',
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
    href: '/financeiro/bancos',
    label: 'Bancos',
    icon: Landmark,
    modulo: 'financeiro',
    roles: ['admin', 'socio'],
    isSubItem: true,
    parentHref: '/financeiro',
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
}

interface SidebarProps {
  profile: Profile
  /** Array de slugs de módulos efetivos para esta empresa (calculado no layout). */
  modulosAtivos: string[]
}

export function Sidebar({ profile, modulosAtivos }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const prefersReduced = useReducedMotion()

  const visibleItems = navItems.filter((item) => {
    // Filtro de role (AND com filtro de módulo)
    if (item.roles && !item.roles.includes(profile.role)) return false
    // Sub-itens só aparecem quando o pai está ativo
    if (item.parentHref && !pathname.startsWith(item.parentHref)) return false
    // Filtro de módulo: item sem módulo → infra (sempre aparece)
    if (item.modulo && !modulosAtivos.includes(item.modulo)) return false
    return true
  })

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-60'
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center border-b border-border',
        collapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'
      )}>
        {!collapsed && (
          <span className="font-logo text-base font-extrabold tracking-[-0.03em] text-sidebar-foreground">
            CRM Studio<span className="text-sidebar-primary">.</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="rounded-lg p-1.5 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {visibleItems.map((item) => {
          const isActive = item.exactMatch
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
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
              <Icon
                className={cn(
                  'relative shrink-0 transition-colors duration-200',
                  item.isSubItem && !collapsed ? 'size-3.5' : 'size-4',
                  isActive
                    ? 'text-sidebar-primary'
                    : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
                )}
              />
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
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        {!collapsed && (
          <div className="mb-2 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {profile.full_name}
            </p>
            <p className="text-xs text-sidebar-foreground/60">
              {roleLabel[profile.role]}
            </p>
          </div>
        )}

        {/* Minha Conta */}
        {(() => {
          const isContaActive = pathname === '/minha-conta' || pathname.startsWith('/minha-conta/')
          return (
            <Link
              href="/minha-conta"
              title={collapsed ? 'Minha Conta' : undefined}
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
  )
}
