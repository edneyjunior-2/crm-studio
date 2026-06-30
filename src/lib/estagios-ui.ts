// Núcleo PURO das etapas do funil — sem imports de servidor, seguro p/ client
// components (charts, badges, kanban). O fetch server-side fica em
// '@/lib/pipeline-estagios' (que re-exporta tudo daqui).

export type EstagioTipo = 'aberto' | 'ganho' | 'perdido'

export interface EstagioPipeline {
  id: string
  slug: string
  nome: string
  ordem: number
  tipo: EstagioTipo
  cor: string | null
  ativo: boolean
}

/** Fallback caso um tenant (por algum motivo) não tenha etapas cadastradas. */
export const ESTAGIOS_PADRAO: Omit<EstagioPipeline, 'id'>[] = [
  { slug: 'prospeccao', nome: 'Prospecção', ordem: 1, tipo: 'aberto', cor: null, ativo: true },
  { slug: 'qualificacao', nome: 'Qualificação', ordem: 2, tipo: 'aberto', cor: null, ativo: true },
  { slug: 'proposta', nome: 'Proposta', ordem: 3, tipo: 'aberto', cor: null, ativo: true },
  { slug: 'negociacao', nome: 'Negociação', ordem: 4, tipo: 'aberto', cor: null, ativo: true },
  { slug: 'fechado_ganho', nome: 'Ganho', ordem: 5, tipo: 'ganho', cor: null, ativo: true },
  { slug: 'fechado_perdido', nome: 'Perdido', ordem: 6, tipo: 'perdido', cor: null, ativo: true },
]

/** Slug estável a partir do nome (sem acento, minúsculo, _). */
export function slugifyEstagio(nome: string): string {
  return (
    nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'etapa'
  )
}

/** Classes de cor do badge/coluna por tipo de etapa (aberto/ganho/perdido). */
export function corPorTipo(tipo: EstagioTipo): { badge: string; dot: string; texto: string } {
  switch (tipo) {
    case 'ganho':
      return { badge: 'bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500', texto: 'text-emerald-600' }
    case 'perdido':
      return { badge: 'bg-red-500/10 text-red-600', dot: 'bg-red-500', texto: 'text-red-600' }
    default:
      return { badge: 'bg-slate-500/10 text-slate-600', dot: 'bg-slate-400', texto: 'text-slate-600' }
  }
}

/** Mapa slug → etapa, p/ resolver nome/tipo/cor a partir de negocio.estagio. */
export function mapaEstagios(estagios: EstagioPipeline[]): Record<string, EstagioPipeline> {
  const m: Record<string, EstagioPipeline> = {}
  for (const e of estagios) m[e.slug] = e
  return m
}
