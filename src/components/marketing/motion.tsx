'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

// Ease-out exponencial — sem bounce/elastic (AC8).
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/**
 * Reveal — entrada sutil ao entrar na viewport (scroll-reveal).
 * Anima só opacity + translateY (transform). Com prefers-reduced-motion,
 * renderiza o estado final sem animação.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  as?: 'div' | 'section' | 'li' | 'span'
}) {
  const reduce = useReducedMotion()
  const Tag = motion[as]

  if (reduce) {
    const Plain = as
    return <Plain className={className}>{children}</Plain>
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
    >
      {children}
    </Tag>
  )
}

/**
 * Entrada na montagem (para o hero — não depende de scroll).
 */
export function Enter({
  children,
  className,
  delay = 0,
  y = 20,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const reduce = useReducedMotion()

  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  )
}
