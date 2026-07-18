import { getAuthPlatformAdmin } from '@/lib/auth'
import Link from 'next/link'
import { Building2, LayoutDashboard, Bug, Calculator, Megaphone, Activity } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await getAuthPlatformAdmin()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar admin */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card px-3 py-6">
        <div className="mb-8 px-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Admin · CRM Studio
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <LayoutDashboard className="size-4 text-muted-foreground" />
            Dashboard
          </Link>
          <Link
            href="/admin/empresas"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Building2 className="size-4 text-muted-foreground" />
            Empresas
          </Link>
          <Link
            href="/admin/bugs"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Bug className="size-4 text-muted-foreground" />
            Bug Reports
          </Link>
          <Link
            href="/admin/sinapi"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Calculator className="size-4 text-muted-foreground" />
            Catálogo SINAPI
          </Link>
          <Link
            href="/admin/ads"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Megaphone className="size-4 text-muted-foreground" />
            Ads
          </Link>
          <Link
            href="/admin/monitoramento"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Activity className="size-4 text-muted-foreground" />
            Centro de Monitoramento CRM Studio
          </Link>
        </nav>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto px-8 py-8">
        {children}
      </main>

      {/* Toaster: o admin não montava — toasts (ex.: botão Sincronizar, Reanalisar) não apareciam */}
      <Toaster richColors position="top-right" />
    </div>
  )
}
