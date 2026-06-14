'use client'

import { usePathname } from 'next/navigation'
import type { Profile } from '@/types'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/solucoes': 'Soluções',
  '/pipeline': 'Pipeline',
  '/financeiro': 'Financeiro',
  '/configuracoes': 'Configurações',
  '/contratos': 'Contratos',
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
}

export function Topbar({ profile }: TopbarProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-6 backdrop-blur-sm">
      <h1 className="text-base font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-medium text-foreground leading-tight">
            {profile.full_name}
          </span>
          <span className="text-xs capitalize text-muted-foreground leading-tight">
            {profile.role}
          </span>
        </div>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-primary/20">
          {getInitials(profile.full_name)}
        </div>
      </div>
    </header>
  )
}
