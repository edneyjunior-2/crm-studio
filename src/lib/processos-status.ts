import type { StatusBadgeVariant } from '@/components/ui/status-badge'

/** Fonte única de status de `processos_juridicos` — 3 valores canônicos. */
export type ProcessoStatus = 'em_transito' | 'suspenso' | 'concluido'

/** Ordem canônica para selects/legendas. */
export const PROCESSO_STATUS: readonly ProcessoStatus[] = ['em_transito', 'suspenso', 'concluido'] as const

/** Allow-list server-side (usar em vez de literal duplicado). */
export const PROCESSO_STATUS_VALIDOS: readonly string[] = PROCESSO_STATUS

export const PROCESSO_STATUS_LABEL: Record<ProcessoStatus, string> = {
  em_transito: 'Em trânsito',
  suspenso:    'Suspenso',
  concluido:   'Concluído',
}

/** Variant do <StatusBadge> por status. */
export const PROCESSO_STATUS_VARIANT: Record<ProcessoStatus, StatusBadgeVariant> = {
  em_transito: 'em_transito',
  suspenso:    'suspenso',
  concluido:   'concluido',
}

/**
 * Classes Tailwind para os pontos que NÃO usam <StatusBadge>
 * (processo-card = pill; processos-dashboard = dot + texto).
 */
export const PROCESSO_STATUS_UI: Record<ProcessoStatus, {
  pill: string   // fundo + texto (pill do processo-card)
  dot:  string   // bolinha da legenda (processos-dashboard)
  text: string   // só texto (processos-dashboard)
}> = {
  em_transito: { pill: 'bg-green-500/10 text-green-700 dark:text-green-400',       dot: 'bg-green-500',   text: 'text-green-700 dark:text-green-400' },
  suspenso:    { pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',       dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400' },
  concluido:   { pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
}

function isProcessoStatus(s: string): s is ProcessoStatus {
  return (PROCESSO_STATUS as readonly string[]).includes(s)
}

/** Label com fallback seguro para valores legados/desconhecidos. */
export function labelStatusProcesso(s: string): string {
  return isProcessoStatus(s) ? PROCESSO_STATUS_LABEL[s] : s
}

/** Variant com fallback (cai no neutro do StatusBadge se desconhecido). */
export function variantStatusProcesso(s: string): StatusBadgeVariant | string {
  return isProcessoStatus(s) ? PROCESSO_STATUS_VARIANT[s] : s
}
