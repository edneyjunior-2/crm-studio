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
import { type Modulo, temModulo, MODULO_LABEL } from '@/lib/modulos'

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

interface ModuloAccessResult {
  ok: boolean
  /** Rota de redirect apropriada quando ok === false (uso em Server Components). */
  redirectTo?: string
  /** Mensagem amigável quando ok === false (uso em Server Actions). */
  message?: string
}

/**
 * Resolução única do acesso a um módulo — fonte da verdade compartilhada por
 * `requireModulo` (layouts/Server Components, redireciona) e `assertModulo`
 * (Server Actions, retorna erro). NÃO duplicar esta lógica em outro lugar.
 *
 * Fluxo:
 *  1. Chama getAuthUser() → plano, status, supabase, empresaId.
 *  2. Se acessoLiberado(status) === false → bloqueia (paywall).
 *  3. Lê empresas.modulos_ativos (overrides/add-ons da empresa).
 *  4. Se temModulo(plano, modulo, extras) === false → bloqueia (upgrade).
 *  5. RBAC por usuário (modulos_permitidos) → bloqueia se o módulo não está liberado.
 */
async function resolveModuloAccess(modulo: Modulo): Promise<ModuloAccessResult> {
  const { plano, status, empresaId, supabase, role, modulosPermitidos } = await getAuthUser()

  if (!acessoLiberado(status)) {
    return {
      ok: false,
      redirectTo: '/assinatura',
      message: 'Sua assinatura está inativa. Regularize o pagamento para continuar.',
    }
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
    return {
      ok: false,
      redirectTo: `/upgrade?modulo=${modulo}`,
      message: `O módulo "${MODULO_LABEL[modulo]}" não está disponível no seu plano atual.`,
    }
  }

  // RBAC por usuário: admin/null = sem restrição; senão o módulo precisa estar liberado.
  if (role !== 'admin' && modulosPermitidos != null && !modulosPermitidos.includes(modulo)) {
    return {
      ok: false,
      redirectTo: '/dashboard',
      message: 'Você não tem permissão para acessar este módulo.',
    }
  }

  return { ok: true }
}

/**
 * Verifica se o usuário autenticado tem acesso ao módulo.
 * Para uso em Server Components / Route Handlers (não em Client Components).
 * Sem acesso → redireciona (paywall/upgrade/dashboard). Ver `resolveModuloAccess`.
 *
 * @param modulo - Slug do módulo a verificar (ex.: 'financeiro', 'contratos')
 */
export async function requireModulo(modulo: Modulo): Promise<void> {
  const result = await resolveModuloAccess(modulo)
  if (!result.ok && result.redirectTo) redirect(result.redirectTo)
}

/**
 * Gate server-side de módulo para Server Actions (mutações).
 *
 * Diferente de `requireModulo`, NÃO redireciona — retorna `null` quando o
 * módulo está liberado, ou uma mensagem de erro amigável quando não está.
 * Reusa exatamente a mesma resolução de plano/módulos/RBAC que os layouts já
 * aplicam (`resolveModuloAccess`) — nenhuma regra de plano duplicada aqui.
 *
 * Uso típico:
 *   const erro = await assertModulo('financeiro')
 *   if (erro) return { error: erro }   // se a action retorna { error? }
 *   // ou, se a action não tem esse formato:
 *   if (erro) throw new Error(erro)
 *
 * Chame SEMPRE no topo da action, antes de qualquer leitura/escrita — uma
 * chamada direta à action (sem passar pela UI) precisa ser barrada aqui.
 */
export async function assertModulo(modulo: Modulo): Promise<string | null> {
  const result = await resolveModuloAccess(modulo)
  return result.ok ? null : (result.message ?? 'Módulo não disponível no seu plano.')
}
