'use client'

import { useEffect } from 'react'
import { trackTrialIniciadoOnce } from '@/lib/analytics'

/**
 * Dispara a conversão 'trial_iniciado' — só é montado pelo Server Component
 * (page.tsx) quando o status da empresa JÁ deixou de ser 'pendente_cartao',
 * ou seja, quando o webhook do Asaas já confirmou o cartão. Nunca dispara
 * apenas por causa do load desta página (ver invariante de segurança: a
 * página de sucesso nunca libera acesso por conta própria, só lê e espera).
 */
export function TrialIniciadoTracker() {
  useEffect(() => {
    trackTrialIniciadoOnce({ value: 297, currency: 'BRL' })
  }, [])

  return null
}
