'use client'

import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Sun, Moon, Menu, Building2, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/types'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/atendimento': 'Atendimento',
  '/clientes': 'Clientes',
  '/solucoes': 'Soluções',
  '/parceiros': 'Parceiros',
  '/pipeline': 'Pipeline',
  '/financeiro': 'Financeiro',
  '/calendario': 'Calendário',
  '/processos': 'Processos',
  '/contratos': 'Contratos',
  '/estoque': 'Estoque',
  '/rh': 'RH',
  '/obras': 'Obras',
  '/automacoes': 'Automações',
  '/fluxos': 'Fluxos',
  '/configuracoes': 'Configurações',
  '/minha-conta': 'Minha Conta',
  '/onboarding': 'Onboarding',
}

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return title
    }
  }
  return 'CRM Studio'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

interface TopbarProps {
  profile: Profile
  onMenuClick?: () => void
  isPlatformAdmin?: boolean
  empresaNome?: string | null
}

export function Topbar({ profile, onMenuClick, isPlatformAdmin = false, empresaNome }: TopbarProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-6 backdrop-blur-sm">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden mr-2 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="text-base font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Switcher de tenant — apenas para platform admin */}
        {isPlatformAdmin && (
          <Link
            href="/selecionar-empresa"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Trocar empresa ativa"
          >
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-[120px] truncate">
              {empresaNome ?? 'Selecionar empresa'}
            </span>
            <ArrowLeftRight className="size-3 shrink-0 text-muted-foreground" />
          </Link>
        )}

        {/* Dark / Light toggle */}
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={resolvedTheme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {resolvedTheme === 'dark'
            ? <Sun className="size-4" />
            : <Moon className="size-4" />}
        </button>

        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-medium text-foreground leading-tight">
            {profile.full_name}
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            {{ admin: 'Administrador', socio: 'Sócio', comercial: 'Comercial', parceiro: 'Parceiro' }[profile.role] ?? profile.role}
          </span>
        </div>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-primary/20">
          {getInitials(profile.full_name)}
        </div>
      </div>
    </header>
  )
}
