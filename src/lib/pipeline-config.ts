// Import type-only: este arquivo é importado por componentes 'use client' (só
// pelo tipo PipelineConfig / a constante PIPELINE_CONFIG_DEFAULT). `import type`
// garante que o import é apagado na compilação — nunca arrasta `createClient`
// (e, por tabela, `next/headers`) pro bundle do client.
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Flags de obrigatoriedade do formulário de negócio, configuráveis por empresa. */
export interface PipelineConfig {
  exige_cliente: boolean
  exige_produto: boolean
  exige_responsavel: boolean
}

/**
 * Defaults quando a empresa ainda não tem `config.pipeline` salvo — preservam o
 * comportamento histórico (cliente + produto obrigatórios; responsável sempre o
 * criador, sem exigir escolha explícita).
 */
export const PIPELINE_CONFIG_DEFAULT: PipelineConfig = {
  exige_cliente: true,
  exige_produto: true,
  exige_responsavel: false,
}

/**
 * Lê `empresas.config.pipeline` do tenant efetivo e devolve os flags já com os
 * defaults aplicados. SELECT via client do usuário é permitido pela policy
 * `empresa_self_select` (id = current_empresa_id()) — não precisa de service-role
 * para leitura, só para gravar (ver `salvarPipelineConfig`).
 */
export async function getPipelineConfig(
  supabase: SupabaseServerClient,
  empresaId: string | null,
): Promise<PipelineConfig> {
  if (!empresaId) return PIPELINE_CONFIG_DEFAULT

  const { data } = await supabase
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .maybeSingle()

  const config = (data?.config as Record<string, unknown> | null) ?? {}
  const pipeline = (config.pipeline as Partial<PipelineConfig> | null | undefined) ?? {}

  return {
    exige_cliente: pipeline.exige_cliente ?? PIPELINE_CONFIG_DEFAULT.exige_cliente,
    exige_produto: pipeline.exige_produto ?? PIPELINE_CONFIG_DEFAULT.exige_produto,
    exige_responsavel: pipeline.exige_responsavel ?? PIPELINE_CONFIG_DEFAULT.exige_responsavel,
  }
}
