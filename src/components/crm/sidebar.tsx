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
  LayoutTemplate,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  Boxes,
  IdCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'
import { logout } from '@/app/(auth)/login/actions'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: Profile['role'][]
  isSubItem?: boolean
  exactMatch?: boolean
  parentHref?: string
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/solucoes',
    label: 'Soluções',
    icon: Package,
  },
  {
    href: '/parceiros',
    label: 'Parceiros',
    icon: Handshake,
  },
  {
    href: '/clientes',
    label: 'Clientes',
    icon: Users,
  },
  {
    href: '/pipeline',
    label: 'Pipeline',
    icon: TrendingUp,
    exactMatch: true,
  },
  {
    href: '/pipeline/historico-perdidos',
    label: 'Hist. Perdidos',
    icon: TrendingDown,
    isSubItem: true,
    parentHref: '/pipeline',
  },
  {
    href: '/fluxos',
    label: 'Fluxos',
    icon: LayoutTemplate,
  },
  {
    href: '/calendario',
    label: 'Calendário',
    icon: CalendarDays,
  },
  {
    href: '/financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    exactMatch: true,
  },
  {
    href: '/financeiro/bancos',
    label: 'Bancos',
    icon: Landmark,
    roles: ['admin', 'socio'],
    isSubItem: true,
    parentHref: '/financeiro',
  },
  {
    href: '/contratos',
    label: 'Contratos',
    icon: FileText,
  },
  {
    href: '/estoque',
    label: 'Estoque',
    icon: Boxes,
    roles: ['admin', 'socio'],
  },
  {
    href: '/rh',
    label: 'RH',
    icon: IdCard,
    roles: ['admin'],
  },
  {
    href: '/automacoes',
    label: 'Automações',
    icon: Zap,
    roles: ['admin'],
  },
]

const roleLabel: Record<Profile['role'], string> = {
  admin: 'Administrador',
  socio: 'Sócio',
  comercial: 'Comercial',
}

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const prefersReduced = useReducedMotion()

  const visibleItems = navItems.filter((item) => {
    if (item.roles && !item.roles.includes(profile.role)) return false
    if (item.parentHref && !pathname.startsWith(item.parentHref)) return false
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
      <div
        className={cn(
          'flex items-center border-b border-border',
          collapsed ? 'justify-center px-0 py-4' : 'gap-3 px-5 py-4'
        )}
      >
        {collapsed ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary font-logo text-sm font-extrabold text-sidebar">
            CS
          </span>
        ) : (
          <span className="font-logo text-base font-extrabold tracking-[-0.03em] text-sidebar-foreground">
            CRM Studio<span className="text-sidebar-primary">.</span>
          </span>
        )}
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

        {/* Toggle collapse */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={cn(
            'mt-1 flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            collapsed ? 'justify-center px-0' : 'gap-2.5'
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
