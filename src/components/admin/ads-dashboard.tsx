'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Embed do relatório Looker Studio com as métricas da campanha de Google Ads
 * do próprio CRM Studio (não é por-tenant — visão exclusiva do platform-admin).
 */
export function AdsDashboard({ src }: { src: string }) {
  const [carregado, setCarregado] = useState(false)

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card">
      {!carregado && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando painel…
        </div>
      )}
      <iframe
        src={src}
        title="Painel de Campanhas — Google Ads"
        onLoad={() => setCarregado(true)}
        className="block h-[1200px] w-full border-0"
        allowFullScreen
      />
    </div>
  )
}
