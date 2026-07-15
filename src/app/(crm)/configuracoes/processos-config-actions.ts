'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthAdmin } from '@/lib/auth'
import { getProcessosConfig } from '@/lib/processos-config'

/**
 * Salva o advogado padrão em `empresas.config.processos.advogado_padrao_id`.
 *
 * GOTCHA: `UPDATE public.empresas` foi revogado de `authenticated` (migration
 * 20260703130000_protege_billing_empresas) — só service-role grava. Por isso
 * usamos `createAdminClient()` aqui, com `getAuthAdmin()` validando a role e
 * `.eq('id', empresaId)` escopando ao tenant do chamador. Faz merge só em
 * `config.processos`, preservando as demais chaves de `config` (ex.: `pipeline`).
 */
export async function salvarAdvogadoPadrao(
  advogadoId: string | null,
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  // Fronteira de confiança: o id vem do client, então confirma que o advogado
  // pertence ao mesmo tenant do chamador antes de gravar — evita apontar o
  // padrão para um usuário de outra empresa. Leitura via client regular (RLS
  // já escopa `profiles` por tenant); o `.eq('empresa_id', ...)` explícito é
  // defesa em profundidade, não a única barreira.
  if (advogadoId) {
    const { data: advogado, error: advErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', advogadoId)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (advErr) return { error: advErr.message }
    if (!advogado) return { error: 'Advogado inválido.' }
  }

  const db = createAdminClient()

  const { data: emp, error: readErr } = await db
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .single()

  if (readErr) return { error: readErr.message }

  const configAtual = (emp?.config as Record<string, unknown> | null) ?? {}
  const processosAtual = (configAtual.processos as Record<string, unknown> | null) ?? {}
  const novoConfig = {
    ...configAtual,
    processos: {
      ...processosAtual,
      advogado_padrao_id: advogadoId,
    },
  }

  const { error } = await db
    .from('empresas')
    .update({ config: novoConfig })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

/**
 * Aplica o advogado padrão a todos os processos do tenant que ainda não têm
 * responsável (`advogado_id IS NULL`) — backfill retroativo disparado manualmente
 * pelo admin. Usa o client regular (não `createAdminClient()`): a RLS já dá ao
 * admin UPDATE em todos os processos do próprio tenant, então não há motivo pra
 * bypassar RLS aqui — diferente de `salvarAdvogadoPadrao`, que grava em `empresas`
 * (tabela com UPDATE revogado do role `authenticated`).
 *
 * Não dispara e-mail de notificação — diferente de `reatribuirResponsavel`
 * (processos/responsabilidades/actions.ts), que intencionalmente avisa por
 * e-mail uma reatribuição pontual. Aqui é backfill em massa; reusar aquele
 * e-mail geraria N mensagens de uma vez, o que não é o comportamento desejado.
 */
export async function aplicarPadraoProcessosSemResponsavel(): Promise<{
  error?: string
  atualizados?: number
}> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const { advogado_padrao_id: advogadoPadraoId } = await getProcessosConfig(supabase, empresaId)
  if (!advogadoPadraoId) {
    return { error: 'Defina um advogado padrão antes de aplicar.' }
  }

  const { data, error } = await supabase
    .from('processos_juridicos')
    .update({ advogado_id: advogadoPadraoId })
    .is('advogado_id', null)
    .eq('empresa_id', empresaId)
    .select('id')

  if (error) return { error: error.message }

  revalidatePath('/processos')
  revalidatePath('/processos/responsabilidades')
  return { atualizados: data?.length ?? 0 }
}
