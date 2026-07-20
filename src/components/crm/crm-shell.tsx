'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/crm/sidebar'
import { Topbar } from '@/components/crm/topbar'
import type { Profile } from '@/types'

interface CRMShellProps {
  profile: Profile
  modulosAtivos: string[]
  children: React.ReactNode
  empresaId?: string | null
  empresaNome?: string | null
  isPlatformAdmin?: boolean
  /** Contagem inicial de conversas não lidas (badge do item "WhatsApp"), vinda do server. */
  unreadWhatsappInicial?: number
  /** Signed URL da foto de perfil do usuário logado, já resolvida no layout (server). */
  avatarUrl?: string | null
}

export function CRMShell({ profile, modulosAtivos, children, empresaId, empresaNome, isPlatformAdmin, unreadWhatsappInicial, avatarUrl }: CRMShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        profile={profile}
        modulosAtivos={modulosAtivos}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        empresaId={empresaId}
        empresaNome={empresaNome}
        unreadWhatsappInicial={unreadWhatsappInicial}
        avatarUrl={avatarUrl}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          profile={profile}
          onMenuClick={() => setSidebarOpen(true)}
          isPlatformAdmin={isPlatformAdmin ?? false}
          empresaNome={empresaNome ?? null}
          avatarUrl={avatarUrl}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 crm-grid-texture">{children}</main>
      </div>
    </div>
  )
}
