'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from '@/components/ui/navigation-menu'

const PRODUTO_SUBNAV = [
  { href: '/produto', label: 'Visão geral' },
  { href: '/produto/advocacia', label: 'Advocacia' },
  { href: '/produto/engenharia', label: 'Engenharia' },
  { href: '/produto/frete', label: 'Frete e Logística' },
]

const NAV = [
  { href: '/precos', label: 'Preços' },
  { href: '/contato', label: 'Contato' },
]

function Wordmark() {
  return (
    <Link
      href="/"
      className="font-logo text-lg font-extrabold tracking-[-0.03em] text-foreground"
    >
      CRM Studio<span className="text-accent">.</span>
    </Link>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const produtoActive = pathname === '/produto' || pathname.startsWith('/produto/')

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6 sm:px-8">
        <div className="flex items-center gap-10">
          <Wordmark />
          <NavigationMenu className="hidden md:block">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={produtoActive ? 'text-foreground' : ''}
                >
                  Produto
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  {PRODUTO_SUBNAV.map((item) => (
                    <NavigationMenuLink
                      key={item.href}
                      render={<Link href={item.href} />}
                      active={pathname === item.href}
                    >
                      {item.label}
                    </NavigationMenuLink>
                  ))}
                </NavigationMenuContent>
              </NavigationMenuItem>
              {NAV.map((item) => {
                const active = pathname === item.href
                return (
                  <NavigationMenuItem key={item.href}>
                    <NavigationMenuLink
                      render={<Link href={item.href} />}
                      active={active}
                      className={`relative rounded-none bg-transparent px-0 py-1 text-sm hover:bg-transparent data-[active]:bg-transparent data-[active]:font-normal ${
                        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {item.label}
                      {active && (
                        <span className="absolute -bottom-px left-0 h-0.5 w-full rounded-full bg-accent" />
                      )}
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                )
              })}
            </NavigationMenuList>
            <NavigationMenuViewport align="start" />
          </NavigationMenu>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Começar grátis
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          className="flex size-11 items-center justify-center rounded-lg text-foreground md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-border bg-background px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            <span className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Produto
            </span>
            {PRODUTO_SUBNAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-4 text-sm text-foreground hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-2 text-sm text-foreground hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-2 flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background"
            >
              Começar grátis
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
