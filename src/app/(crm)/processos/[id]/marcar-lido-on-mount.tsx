'use client'

import { useEffect, useRef } from 'react'
import { marcarComoLido } from './actions'

/**
 * Marca as movimentações do processo como lidas APÓS a renderização (no client),
 * em vez de durante o render do Server Component (onde uma mutação + revalidatePath
 * é anti-pattern e pode rodar a cada render). Dispara uma única vez ao montar.
 */
export function MarcarLidoOnMount({ processoId }: { processoId: string }) {
  const jaRodou = useRef(false)

  useEffect(() => {
    if (jaRodou.current) return
    jaRodou.current = true
    void marcarComoLido(processoId)
  }, [processoId])

  return null
}
