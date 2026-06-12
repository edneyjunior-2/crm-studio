'use client'

import { useEffect, useState } from 'react'

export function Relogio() {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    function tick() {
      const now = new Date()
      const h = now.getHours().toString().padStart(2, '0')
      const m = now.getMinutes().toString().padStart(2, '0')
      const s = now.getSeconds().toString().padStart(2, '0')
      setTime(`${h}:${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10">
      <p className="font-mono text-[clamp(3rem,8vw,5rem)] font-bold tracking-tight text-foreground tabular-nums">
        {time}
      </p>
      <p className="text-xs text-muted-foreground">
        {new Date().toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>
    </div>
  )
}
