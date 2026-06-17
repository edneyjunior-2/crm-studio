'use client'

import { motion, useReducedMotion, useInView, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode, type ElementType } from 'react'

// Ease-out exponencial — sem bounce/elastic.
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/* ─────────────────────────────────────────────── Reveal (scroll-reveal) ── */

/**
 * Reveal — entrada sutil ao entrar na viewport (scroll-reveal).
 * Anima só opacity + translateY. Com prefers-reduced-motion, renderiza estático.
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
    const Plain = as as ElementType
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

/* ──────────────────────────────────────────────── Enter (mount animation) ── */

/**
 * Enter — animação na montagem do componente (hero, acima do fold).
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

/* ────────────────────────────────────────── StaggerText (word by word) ── */

/**
 * StaggerText — anima palavra por palavra no mount.
 * Útil para headlines grandes no hero.
 */
export function StaggerText({
  text,
  className,
  wordClassName,
  delay = 0,
  staggerDelay = 0.06,
}: {
  text: string
  className?: string
  wordClassName?: string
  delay?: number
  staggerDelay?: number
}) {
  const reduce = useReducedMotion()
  const words = text.split(' ')

  if (reduce) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className={`inline-block ${wordClassName ?? ''}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.65,
            ease: EASE_OUT,
            delay: delay + i * staggerDelay,
          }}
          style={{ marginRight: '0.28em' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}

/* ────────────────────────────────────────────────── Counter (0 → final) ── */

/**
 * Counter — anima um número de 0 até o valor final ao entrar na viewport.
 * Usa useMotionValue para não causar re-render em cada frame.
 */
export function Counter({
  to,
  prefix = '',
  suffix = '',
  className,
  duration = 1.4,
}: {
  to: number
  prefix?: string
  suffix?: string
  className?: string
  duration?: number
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const raw = useMotionValue(0)
  const spring = useSpring(raw, { stiffness: 60, damping: 18 })

  useEffect(() => {
    if (inView && !reduce) {
      // Simples tween via spring
      const start = performance.now()
      const end = start + duration * 1000
      const tick = () => {
        const now = performance.now()
        const t = Math.min((now - start) / (duration * 1000), 1)
        raw.set(t * to)
        if (t < 1) requestAnimationFrame(tick)
        else raw.set(to)
      }
      requestAnimationFrame(tick)
    }
  }, [inView, reduce, to, duration, raw])

  // Formata o valor atual (sincronamente — sem React state)
  const display = reduce
    ? `${prefix}${to.toLocaleString('pt-BR')}${suffix}`
    : undefined

  if (reduce) {
    return <span className={className}>{display}</span>
  }

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>
        {/* Atualiza o texto via subscribe — sem re-render */}
        <SpringCounter spring={spring} />
      </motion.span>
      {suffix}
    </span>
  )
}

function SpringCounter({ spring }: { spring: ReturnType<typeof useSpring> }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    return spring.on('change', (v) => {
      if (ref.current) {
        ref.current.textContent = Math.round(v).toLocaleString('pt-BR')
      }
    })
  }, [spring])

  return <span ref={ref}>0</span>
}

/* ─────────────────────────────────────────────── TextShimmer (badge shimmer) ── */

/**
 * TextShimmer — texto com efeito de brilho percorrendo as letras em loop.
 * Usa background-clip: text com gradiente animado via CSS keyframes.
 */
export function TextShimmer({
  children,
  className,
  shimmerWidth = 80,
}: {
  children: ReactNode
  className?: string
  shimmerWidth?: number
}) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <span className={className}>{children}</span>
  }

  return (
    <>
      <span
        className={`inline-block ${className ?? ''}`}
        style={{
          backgroundImage: `linear-gradient(
            110deg,
            currentColor 30%,
            rgba(255,255,255,0.75) 50%,
            currentColor 70%
          )`,
          backgroundSize: `${shimmerWidth * 3}px 100%`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `text-shimmer 2.4s linear infinite`,
        }}
      >
        {children}
      </span>
      <style>{`
        @keyframes text-shimmer {
          from { background-position: -${shimmerWidth * 2}px 0; }
          to   { background-position: ${shimmerWidth * 4}px 0; }
        }
      `}</style>
    </>
  )
}

/* ────────────────────────────────────────────────── Tilt (3D card hover) ── */

/**
 * Tilt — inclina o card seguindo o cursor em perspectiva 3D.
 * Usa useMotionValue + useSpring para retorno suave ao neutro.
 */
export function Tilt({
  children,
  className,
  maxDeg = 8,
}: {
  children: ReactNode
  className?: string
  maxDeg?: number
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const rotateX = useSpring(rawX, { stiffness: 260, damping: 26 })
  const rotateY = useSpring(rawY, { stiffness: 260, damping: 26 })

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) / (rect.width / 2)
    const dy = (e.clientY - cy) / (rect.height / 2)
    rawX.set(-dy * maxDeg)
    rawY.set(dx * maxDeg)
  }

  function onMouseLeave() {
    rawX.set(0)
    rawY.set(0)
  }

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </motion.div>
  )
}

/* ──────────────────────────────────────────── BorderTrail (animated border) ── */

/**
 * BorderTrail — "luz" que percorre o contorno do card em conic-gradient.
 * Wrapper: precisa de `relative overflow-hidden` no className.
 */
export function BorderTrail({
  children,
  className,
  size = 120,
  duration = 3,
}: {
  children: ReactNode
  className?: string
  size?: number
  duration?: number
}) {
  const reduce = useReducedMotion()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!reduce && hovered && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            padding: 1,
            background: `conic-gradient(from var(--trail-angle, 0deg), transparent 0%, rgba(232,145,91,0.8) 15%, transparent 30%)`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            animation: `border-trail ${duration}s linear infinite`,
          }}
        />
      )}
      {children}
      {!reduce && (
        <style>{`
          @keyframes border-trail {
            from { --trail-angle: 0deg; }
            to   { --trail-angle: 360deg; }
          }
        `}</style>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────── FloatingDots background ── */

/**
 * FloatingDots — grade de pontos com movimento suave em parallax.
 * Renderizar atrás do conteúdo com pointer-events-none + fixed/absolute.
 */
export function FloatingDots({
  className,
  cols = 20,
  rows = 12,
}: {
  className?: string
  cols?: number
  rows?: number
}) {
  const reduce = useReducedMotion()

  if (reduce) return null

  return (
    <div
      className={`pointer-events-none select-none ${className ?? ''}`}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <motion.span
            key={`${r}-${c}`}
            className="absolute block size-[3px] rounded-full bg-current"
            style={{
              left: `${(c / (cols - 1)) * 100}%`,
              top: `${(r / (rows - 1)) * 100}%`,
            }}
            animate={{
              opacity: [0.12, 0.28, 0.12],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 3 + ((r * cols + c) % 5) * 0.6,
              repeat: Infinity,
              delay: ((r * cols + c) % 17) * 0.18,
              ease: 'easeInOut',
            }}
          />
        ))
      )}
    </div>
  )
}
