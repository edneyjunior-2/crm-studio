/**
 * gating.ts — Helpers de controle de acesso (status e módulo)
 *
 * Definidos aqui, prontos para o Stream 2 usar.
 * NÃO importados/chamados por nenhuma rota ainda (wiring é o Stream 2).
 *
 * Tipos reaproveitados de src/lib/auth.ts.
 */

import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import type { StatusEmpresa, PlanoEmpresa } from '@/lib/auth'
import { type Modulo, temModulo } from '@/lib/modulos'

// Re-exporta para conveniência dos consumidores
export type { StatusEmpresa, PlanoEmpresa, Modulo }

// ---------------------------------------------------------------------------
// Gate de ACESSO — status da assinatura
// ---------------------------------------------------------------------------

/**
 * Retorna `true` se o status da assinatura permite acesso ao app.
 *
 * | Status    | Acessa? |
 * |-----------|---------|
 * | trial     | ✅      |
 * | ativo     | ✅      |
 * | pendente  | ✅ (com aviso — dunning suave) |
 * | atrasado  | ✅ (com aviso — grace period) |
 * | suspenso  | ❌ paywall |
 * | cancelado | ❌ paywall |
 * | desconhecido | ❌ (fail-closed por segurança) |
 */
export function acessoLiberado(status: StatusEmpresa): boolean {
  return (['trial', 'ativo', 'pendente', 'atrasado'] as StatusEmpresa[]).includes(status)
}

// ---------------------------------------------------------------------------
// Gate de MÓDULO — plano + extras por empresa
// ---------------------------------------------------------------------------

/**
 * Verifica se o usuário autenticado tem acesso ao módulo.
 * Para uso em Server Components / Route Handlers (não em Client Components).
 *
 * Fluxo:
 *  1. Chama getAuthUser() → plano, status, supabase, empresaId.
 *  2. Se acessoLiberado(status) === false → redireciona para /assinatura (paywall).
 *  3. Lê empresas.modulos_ativos (overrides/add-ons da empresa).
 *  4. Se temModulo(plano, modulo, extras) === false → redireciona para /upgrade?modulo=<slug>.
 *
 * @param modulo - Slug do módulo a verificar (ex.: 'financeiro', 'contratos')
 *
 * ⚠️  ATENÇÃO: não wire esta função em nenhuma rota ainda.
 *     O wiring (layout.tsx por módulo) é responsabilidade do Stream 2.
 */
export async function requireModulo(modulo: Modulo): Promise<void> {
  const { plano, status, empresaId, supabase } = await getAuthUser()

  if (!acessoLiberado(status)) {
    redirect('/assinatura')
  }

  let extras: string[] = []
  if (empresaId) {
    const { data } = await supabase
      .from('empresas')
      .select('modulos_ativos')
      .eq('id', empresaId)
      .single()
    extras = data?.modulos_ativos ?? []
  }

  if (!temModulo(plano, modulo, extras)) {
    redirect(`/upgrade?modulo=${modulo}`)
  }
}
