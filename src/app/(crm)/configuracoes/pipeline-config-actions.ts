'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthAdmin } from '@/lib/auth'
import type { PipelineConfig } from '@/lib/pipeline-config'

/**
 * Salva os flags de obrigatoriedade do pipeline em `empresas.config.pipeline`.
 *
 * GOTCHA: `UPDATE public.empresas` foi revogado de `authenticated` (migration
 * 20260703130000_protege_billing_empresas) — só service-role grava. Por isso
 * usamos `createAdminClient()` aqui, com `getAuthAdmin()` validando a role e
 * `.eq('id', empresaId)` escopando ao tenant do chamador. Faz merge só em
 * `config.pipeline`, preservando as demais chaves de `config` (ex.: white-label
 * de contratos).
 */
export async function salvarPipelineConfig(
  flags: PipelineConfig,
): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const db = createAdminClient()

  const { data: emp, error: readErr } = await db
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .single()

  if (readErr) return { error: readErr.message }

  const configAtual = (emp?.config as Record<string, unknown> | null) ?? {}
  const novoConfig = {
    ...configAtual,
    pipeline: {
      exige_cliente: !!flags.exige_cliente,
      exige_produto: !!flags.exige_produto,
      exige_responsavel: !!flags.exige_responsavel,
    },
  }

  const { error } = await db
    .from('empresas')
    .update({ config: novoConfig })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  revalidatePath('/pipeline')
  return {}
}
