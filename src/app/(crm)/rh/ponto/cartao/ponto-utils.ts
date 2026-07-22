export function formatarMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

export function formatarDelta(min: number): string {
  const sinal = min > 0 ? '+' : min < 0 ? '−' : ''
  return `${sinal}${formatarMinutos(Math.abs(min))}`
}
