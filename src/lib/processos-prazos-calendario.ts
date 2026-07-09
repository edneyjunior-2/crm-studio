// Helper compartilhado, cross-processo, escopado por empresa — usado pela
// visão "Prazos" do Calendário (src/app/(crm)/calendario/**). Server-safe (sem
// 'use client'). Não importa nada de src/app/(crm)/processos/** — lane de
// outro stream em paralelo — para não acoplar/quebrar em build concorrente.
//
// Import type-only: apaga na compilação, não arrasta `createClient` (nem
// `next/headers`) pra dentro de bundles de client. Mesmo padrão de
// src/lib/pipeline-config.ts.
import type { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// ponytail: reimplementação DELIBERADA e idêntica (mesmo comportamento) de
// isAudiencia() em src/app/(crm)/processos/[id]/page.tsx — cópia, não import,
// porque aquele arquivo está fora da lane deste stream (outro stream mexe lá
// em paralelo). Só "audiência"/"audiencia" — evita falso-positivo com
// "julgamento"/"sessão"/"instrução".
export function isAudiencia(descricao: string): boolean {
  const lower = descricao.toLowerCase()
  return lower.includes('audiência') || lower.includes('audiencia')
}

// getFullYear/getMonth/getDate — nunca toISOString() para data local (ver CLAUDE.md).
function hojeStr(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

export type PrazoCalendario = {
  id: string
  processo_id: string
  numero_processo: string
  descricao: string
  data_prazo: string // 'YYYY-MM-DD' — formatar via .slice(0,10).split('-'), nunca new Date() cru
  cumprido: boolean
  responsavel_nome: string | null
}

export type AudienciaCalendario = {
  id: string
  processo_id: string
  numero_processo: string
  descricao: string
  complemento: string | null
  data: string // 'YYYY-MM-DD' (movimentacoes_processo.data_movimentacao)
  vara: string | null
  comarca: string | null
  cliente_nome: string | null
  advogado_email: string | null
}

/**
 * Todos os prazos (`processos_prazos`) do tenant — pendentes e cumpridos. O
 * destaque visual de pendentes/vencidos é responsabilidade da UI (PrazosView);
 * aqui só ordena pendentes primeiro (cumprido asc) e por data_prazo asc.
 * `fetchAllRows` evita o cap de 1000 do PostgREST.
 */
export async function listarPrazosEmpresa(
  supabase: SupabaseServerClient,
  empresaId: string,
): Promise<PrazoCalendario[]> {
  // ponytail: embeds tipados como `unknown` + cast na leitura — o client
  // Supabase deste projeto não usa Database gerado, então o parser de tipos
  // do select() (que roda sobre a string literal) infere relação embutida
  // como array em vez de objeto único quando o select é multilinha. Mesmo
  // padrão usado em processos/page.tsx (ProcessoRow) pro mesmo problema.
  type PrazoRow = {
    id: string
    processo_id: string
    descricao: string
    data_prazo: string
    cumprido: boolean
    processos_juridicos: unknown
    profiles: unknown
  }

  try {
    const rows = await fetchAllRows<PrazoRow>((from, to) =>
      supabase
        .from('processos_prazos')
        .select(`
          id,
          processo_id,
          descricao,
          data_prazo,
          cumprido,
          processos_juridicos(numero_processo),
          profiles!responsavel_id(full_name)
        `)
        .eq('empresa_id', empresaId)
        .order('cumprido', { ascending: true })
        .order('data_prazo', { ascending: true })
        .range(from, to)
    )

    return rows.map((r) => {
      const processo = r.processos_juridicos as { numero_processo: string } | null
      const responsavel = r.profiles as { full_name: string } | null
      return {
        id: r.id,
        processo_id: r.processo_id,
        numero_processo: processo?.numero_processo ?? '—',
        descricao: r.descricao,
        data_prazo: r.data_prazo,
        cumprido: r.cumprido,
        responsavel_nome: responsavel?.full_name ?? null,
      }
    })
  } catch (err) {
    console.error('[processos-prazos-calendario] erro ao listar prazos:', err)
    return []
  }
}

/**
 * Audiências cross-processo, inferidas por heurística de texto sobre
 * `movimentacoes_processo.descricao` (ver isAudiencia acima), usando
 * `data_movimentacao` como data. O `.or(ilike)` é só um PRÉ-CORTE barato no
 * banco para reduzir volume antes de paginar; `isAudiencia()` em memória é a
 * verdade (mesmo critério da função original).
 *
 * E-mail do advogado (`advogado_email`) fica `null`: obtê-lo exigiria a view
 * `profiles_auth` (restrita a service_role/admin client), e este helper só
 * recebe o client do usuário — não vale a pena escalar pra admin client aqui
 * (spec aceita null explicitamente; a lista funcionando > completude do
 * metadado). O dialog de agendamento já funciona sem e-mail pré-selecionado.
 */
export async function listarAudienciasEmpresa(
  supabase: SupabaseServerClient,
  empresaId: string,
): Promise<AudienciaCalendario[]> {
  // ponytail: mesmo motivo do PrazoRow acima — embed tipado `unknown` + cast.
  type MovRow = {
    id: string
    processo_id: string
    descricao: string
    complemento: string | null
    data_movimentacao: string
    processos_juridicos: unknown
  }
  type ProcessoEmbed = {
    numero_processo: string
    vara: string | null
    comarca: string | null
    clientes: { razao_social: string } | null
  }

  try {
    const rows = await fetchAllRows<MovRow>((from, to) =>
      supabase
        .from('movimentacoes_processo')
        .select(`
          id,
          processo_id,
          descricao,
          complemento,
          data_movimentacao,
          processos_juridicos(numero_processo, vara, comarca, clientes(razao_social))
        `)
        .eq('empresa_id', empresaId)
        .or('descricao.ilike.%audiência%,descricao.ilike.%audiencia%')
        // Audiências já realizadas (antes de hoje) não precisam aparecer aqui.
        .gte('data_movimentacao', hojeStr())
        .order('data_movimentacao', { ascending: true })
        .range(from, to)
    )

    return rows
      .filter((r) => isAudiencia(r.descricao))
      .map((r) => {
        const processo = r.processos_juridicos as ProcessoEmbed | null
        return {
          id: r.id,
          processo_id: r.processo_id,
          numero_processo: processo?.numero_processo ?? '—',
          descricao: r.descricao,
          complemento: r.complemento ?? null,
          data: r.data_movimentacao,
          vara: processo?.vara ?? null,
          comarca: processo?.comarca ?? null,
          cliente_nome: processo?.clientes?.razao_social ?? null,
          advogado_email: null,
        }
      })
  } catch (err) {
    console.error('[processos-prazos-calendario] erro ao listar audiências:', err)
    return []
  }
}
