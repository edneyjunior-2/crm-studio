'use client'

import { MapPin } from 'lucide-react'

export function RefazerTourBtn() {
  function handleClick() {
    if (typeof window !== 'undefined' && typeof window.__crmTourStart === 'function') {
      void window.__crmTourStart()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      <MapPin className="size-4 text-accent" />
      Refazer tour guiado
    </button>
  )
}

declare global {
  interface Window {
    __crmTourStart?: () => void
  }
}
