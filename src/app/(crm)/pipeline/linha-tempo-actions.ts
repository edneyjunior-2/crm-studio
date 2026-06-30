'use server'

import { getAuthUser } from '@/lib/auth'
import { listarEstagios } from '@/lib/pipeline-estagios'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EventoTipo =
  | 'criado'
  | 'fechado'
  | 'ligacao'
  | 'email'
  | 'reuniao'
  | 'proposta'
  | 'nota'
  | 'lembrete'

export interface EventoLinhaTempo {
  /** ISO string (timestamptz) ou YYYY-MM-DD — o componente trata cada caso. */
  data: string
  tipo: EventoTipo
  titulo?: string
  descricao?: string | null
  url?: string | null
  /** Só em followups. */
  status?: string | null
  /** 'ganho' | 'perdido' — só no evento 'fechado'. */
  tipoFechamento?: 'ganho' | 'perdido' | null
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function getLinhaTempoNegocio(
  negocioId: string
): Promise<EventoLinhaTempo[]> {
  const { supabase } = await getAuthUser()

  // Carrega negocio, atividades e followups em paralelo
  const [negRes, atRes, fuRes, estagios] = await Promise.all([
    supabase
      .from('negocios')
      .select('created_at, data_fechamento, estagio, motivo_perda, titulo')
      .eq('id', negocioId)
      .single(),

    supabase
      .from('atividades')
      .select('id, tipo, descricao, data_atividade, google_event_url')
      .eq('negocio_id', negocioId)
      .order('data_atividade', { ascending: true })
      .order('created_at', { ascending: true }),

    supabase
      .from('followups')
      .select('id, tipo, data_agendada, observacao, status')
      .eq('negocio_id', negocioId)
      .order('data_agendada', { ascending: true }),

    listarEstagios(true), // inclui inativos para resolver nome de etapas antigas
  ])

  const negocio = negRes.data
  if (!negocio) return []

  const atividades = atRes.data ?? []
  const followups  = fuRes.data ?? []

  // Mapa slug → etapa
  const mapaSlug = new Map(estagios.map((e) => [e.slug, e]))

  const eventos: EventoLinhaTempo[] = []

  // 1. Evento de criação
  eventos.push({
    data: negocio.created_at,
    tipo: 'criado',
    titulo: 'Negócio criado',
  })

  // 2. Atividades
  for (const a of atividades) {
    eventos.push({
      data: a.data_atividade,
      tipo: a.tipo as EventoTipo,
      descricao: a.descricao,
      url: a.google_event_url ?? null,
    })
  }

  // 3. Follow-ups / Lembretes
  for (const f of followups) {
    eventos.push({
      data: f.data_agendada,
      tipo: 'lembrete',
      descricao: f.observacao ?? null,
      status: f.status ?? null,
    })
  }

  // 4. Evento de fechamento (se houver data_fechamento)
  if (negocio.data_fechamento) {
    const estagio  = mapaSlug.get(negocio.estagio)
    const tipoFech = estagio?.tipo === 'ganho' ? 'ganho' : estagio?.tipo === 'perdido' ? 'perdido' : null
    const nomeEst  = estagio?.nome ?? negocio.estagio

    eventos.push({
      data: negocio.data_fechamento,
      tipo: 'fechado',
      titulo: `Fechado — ${nomeEst}`,
      descricao: negocio.motivo_perda ?? null,
      tipoFechamento: tipoFech,
    })
  }

  // Ordena do mais antigo para o mais recente.
  // Normaliza a chave para YYYY-MM-DD para comparação estável entre
  // campos date (YYYY-MM-DD) e timestamptz (ISO longo) — evita reordenação
  // intra-dia por diferença de tipo.
  function toDateKey(iso: string): string {
    return iso.length >= 10 ? iso.slice(0, 10) : iso
  }

  eventos.sort((a, b) => {
    const ka = toDateKey(a.data)
    const kb = toDateKey(b.data)
    if (ka < kb) return -1
    if (ka > kb) return 1
    return 0
  })

  return eventos
}
