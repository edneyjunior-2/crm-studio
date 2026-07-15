// Import type-only: este arquivo é importado por componentes 'use client' (só
// pelo tipo ProcessosConfig / a constante PROCESSOS_CONFIG_DEFAULT). `import type`
// garante que o import é apagado na compilação — nunca arrasta `createClient`
// (e, por tabela, `next/headers`) pro bundle do client.
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Config do módulo Processos (advocacia), configurável por empresa. */
export interface ProcessosConfig {
  /** profiles.id do advogado aplicado por padrão a processos sem responsável explícito. */
  advogado_padrao_id: string | null
}

export const PROCESSOS_CONFIG_DEFAULT: ProcessosConfig = {
  advogado_padrao_id: null,
}

/**
 * Lê `empresas.config.processos` do tenant efetivo e devolve com os defaults
 * aplicados. SELECT via client do usuário é permitido pela policy
 * `empresa_self_select` (id = current_empresa_id()) — não precisa de
 * service-role para leitura, só para gravar (ver processos-config-actions.ts).
 */
export async function getProcessosConfig(
  supabase: SupabaseServerClient,
  empresaId: string | null,
): Promise<ProcessosConfig> {
  if (!empresaId) return PROCESSOS_CONFIG_DEFAULT

  const { data } = await supabase
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .maybeSingle()

  const config = (data?.config as Record<string, unknown> | null) ?? {}
  const processos = (config.processos as Partial<ProcessosConfig> | null | undefined) ?? {}

  return {
    advogado_padrao_id: processos.advogado_padrao_id ?? PROCESSOS_CONFIG_DEFAULT.advogado_padrao_id,
  }
}
