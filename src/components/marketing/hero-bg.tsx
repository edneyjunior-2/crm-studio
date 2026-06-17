'use client'

import { motion, useReducedMotion } from 'motion/react'

export function HeroBg({ className }: { className?: string }) {
  const reduce = useReducedMotion()

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}
      aria-hidden="true"
    >
      {/* Grid de linhas finas */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(20,35,58,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20,35,58,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Blob radial central pulsante */}
      {!reduce && (
        <motion.div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: '70vw',
            height: '50vw',
            maxWidth: 900,
            maxHeight: 640,
            background:
              'radial-gradient(ellipse at center, rgba(232,145,91,0.07) 0%, rgba(20,35,58,0.03) 55%, transparent 80%)',
            filter: 'blur(40px)',
          }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.97, 1.03, 0.97] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Estado estático para reduced-motion */}
      {reduce && (
        <div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: '70vw',
            height: '50vw',
            maxWidth: 900,
            maxHeight: 640,
            background:
              'radial-gradient(ellipse at center, rgba(232,145,91,0.07) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      )}
    </div>
  )
}
