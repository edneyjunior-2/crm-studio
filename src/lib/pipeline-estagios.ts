import { createClient } from '@/lib/supabase/server'
import { ESTAGIOS_PADRAO, type EstagioPipeline } from '@/lib/estagios-ui'

// Re-exporta o núcleo puro p/ quem importa de '@/lib/pipeline-estagios'.
export type { EstagioTipo, EstagioPipeline } from '@/lib/estagios-ui'
export { ESTAGIOS_PADRAO, slugifyEstagio, corPorTipo, mapaEstagios } from '@/lib/estagios-ui'

/**
 * Etapas do funil do tenant atual (RLS isola por empresa via current_empresa_id()).
 * Server-side. Por padrão só as ativas e ordenadas; passe true p/ incluir inativas.
 */
export async function listarEstagios(incluirInativos = false): Promise<EstagioPipeline[]> {
  const supabase = await createClient()
  let q = supabase
    .from('pipeline_estagios')
    .select('id, slug, nome, ordem, tipo, cor, ativo')
    .order('ordem', { ascending: true })
  if (!incluirInativos) q = q.eq('ativo', true)
  const { data } = await q
  const rows = (data ?? []) as EstagioPipeline[]
  if (rows.length === 0) {
    // tenant sem etapas: devolve o padrão (sem id real) só p/ não quebrar a tela
    return ESTAGIOS_PADRAO.map((e, i) => ({ ...e, id: `padrao-${i}` }))
  }
  return rows
}
