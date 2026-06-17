'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react'

export function Spotlight({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 })

  const background = useTransform(
    [springX, springY],
    ([x, y]: number[]) =>
      `radial-gradient(600px circle at ${x * 100}% ${y * 100}%, rgba(232,145,91,0.10) 0%, rgba(20,35,58,0.04) 40%, transparent 70%)`,
  )

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top) / rect.height)
  }

  function onMouseLeave() {
    mouseX.set(0.5)
    mouseY.set(0.5)
  }

  if (reduce) {
    return (
      <div
        className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(600px circle at 50% 33%, rgba(232,145,91,0.08) 0%, rgba(20,35,58,0.03) 40%, transparent 70%)',
        }}
      />
    )
  }

  return (
    <div
      ref={ref}
      className={`pointer-events-auto absolute inset-0 ${className ?? ''}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      aria-hidden="true"
    >
      <motion.div className="absolute inset-0" style={{ background }} />
    </div>
  )
}
