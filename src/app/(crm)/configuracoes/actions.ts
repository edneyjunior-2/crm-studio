'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthAdmin } from '@/lib/auth'
import type { StatusEmpresa } from '@/lib/auth'
import { cancelSubscription } from '@/lib/asaas'
import { encarregadoSchema } from '@/lib/schemas'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Exclusão de conta (gated por pagamento)
// ---------------------------------------------------------------------------

/** Status de empresa que bloqueiam a exclusão (pendência de pagamento). */
const STATUS_BLOQUEIA_EXCLUSAO: StatusEmpresa[] = ['pendente', 'atrasado', 'suspenso']

/**
 * Status de faturas em aberto. O CHECK do banco usa 'vencida' (não 'atrasada'),
 * mas mantemos 'atrasada' por robustez (não casa nenhuma linha → inócuo).
 */
const FATURA_EM_ABERTO = ['pendente', 'vencida', 'atrasada']

export interface StatusPagamento {
  /** true se a conta está EM DIA e pode ser excluída. */
  podeExcluir: boolean
  /** Motivo do bloqueio (null quando podeExcluir === true). */
  motivo: string | null
  status: StatusEmpresa
  plano: string
  /** Qtde de faturas em aberto (pendente/vencida/atrasada). */
  faturasEmAberto: number
}

/**
 * Avalia se uma empresa pode ser excluída, com base no status e nas faturas
 * em aberto. Usa o admin client (bypassa RLS) para garantir leitura completa.
 *
 * Regra:
 *  - plano 'interno' (sem cobrança) → sempre pode.
 *  - status ∈ (ativo, trial) E sem fatura em aberto → pode.
 *  - status ∈ (pendente, atrasado, suspenso) OU fatura em aberto → bloqueia.
 *  - status 'cancelado' → já cancelado, sem cobrança ativa → pode (idempotente).
 */
export async function avaliarPagamento(empresaId: string): Promise<StatusPagamento> {
  const db = createAdminClient()

  const { data: empresa, error: empresaError } = await db
    .from('empresas')
    .select('plano, status')
    .eq('id', empresaId)
    .single()

  if (empresaError || !empresa) {
    throw new Error(empresaError?.message ?? 'Empresa não encontrada.')
  }

  const status = empresa.status as StatusEmpresa
  const plano = empresa.plano as string

  // Plano interno não tem cobrança — sempre liberado.
  if (plano === 'interno') {
    return { podeExcluir: true, motivo: null, status, plano, faturasEmAberto: 0 }
  }

  const { count, error: faturasError } = await db
    .from('faturas')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .in('status', FATURA_EM_ABERTO)

  if (faturasError) {
    throw new Error(faturasError.message)
  }

  const faturasEmAberto = count ?? 0

  if (STATUS_BLOQUEIA_EXCLUSAO.includes(status)) {
    return {
      podeExcluir: false,
      motivo: 'Sua conta possui uma pendência de pagamento. Regularize o pagamento pendente antes de excluir a conta.',
      status,
      plano,
      faturasEmAberto,
    }
  }

  if (faturasEmAberto > 0) {
    return {
      podeExcluir: false,
      motivo: `Há ${faturasEmAberto} ${faturasEmAberto === 1 ? 'fatura em aberto' : 'faturas em aberto'}. Regularize o pagamento pendente antes de excluir a conta.`,
      status,
      plano,
      faturasEmAberto,
    }
  }

  return { podeExcluir: true, motivo: null, status, plano, faturasEmAberto: 0 }
}

/**
 * Exclui (cancela) a conta da empresa do admin autenticado.
 *
 * Segurança: a regra de pagamento é RE-VALIDADA aqui no servidor — o client
 * só faz UX. Confirmação forte (nome da empresa) também é re-checada.
 *
 * Estratégia: soft-cancel (status='cancelado'), NÃO hard-delete. As FKs das
 * tabelas de domínio (clientes, negocios, profiles, rh…) referenciam
 * empresas(id) com NO ACTION (sem ON DELETE CASCADE), então um DELETE direto
 * falharia com violação de chave estrangeira. Cancelar a assinatura no Asaas
 * (best-effort) interrompe cobranças; o status 'cancelado' derruba o acesso
 * (acessoLiberado → false → paywall).
 */
export async function excluirConta(
  confirmacaoNome: string,
): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const db = createAdminClient()

  const { data: empresa, error: empresaError } = await db
    .from('empresas')
    .select('nome, asaas_customer_id')
    .eq('id', empresaId)
    .single()

  if (empresaError) return { error: empresaError.message }
  if (!empresa) return { error: 'Empresa não encontrada.' }

  // Confirmação forte: o nome digitado deve bater com o da empresa.
  if (confirmacaoNome.trim() !== (empresa.nome as string).trim()) {
    return { error: 'O nome digitado não confere com o nome da empresa.' }
  }

  // Re-valida a regra de pagamento NO SERVIDOR (nunca confiar só no client).
  let avaliacao: StatusPagamento
  try {
    avaliacao = await avaliarPagamento(empresaId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Erro ao verificar pagamento: ${msg}` }
  }

  if (!avaliacao.podeExcluir) {
    return { error: avaliacao.motivo ?? 'Regularize o pagamento pendente antes de excluir a conta.' }
  }

  // Cancela a assinatura no Asaas (best-effort — não bloqueia a exclusão se falhar).
  const { data: assinaturas, error: assinaturasError } = await db
    .from('assinaturas')
    .select('id, asaas_subscription_id')
    .eq('empresa_id', empresaId)
    .not('asaas_subscription_id', 'is', null)
    .neq('status', 'cancelado')

  if (assinaturasError) return { error: assinaturasError.message }

  for (const a of assinaturas ?? []) {
    if (!a.asaas_subscription_id) continue
    try {
      await cancelSubscription(a.asaas_subscription_id as string)
    } catch (err) {
      // Best-effort: registra mas segue (a assinatura pode já estar removida no Asaas).
      console.error(`Falha ao cancelar assinatura Asaas ${a.asaas_subscription_id}:`, err)
    }
  }

  // Marca assinaturas como canceladas (espelho local).
  if ((assinaturas ?? []).length > 0) {
    const { error: updAssinaturasError } = await db
      .from('assinaturas')
      .update({ status: 'cancelado', canceled_at: new Date().toISOString() })
      .eq('empresa_id', empresaId)
      .neq('status', 'cancelado')

    if (updAssinaturasError) return { error: updAssinaturasError.message }
  }

  // Soft-cancel da empresa: status='cancelado' + ativo=false + carimbo p/ retenção.
  // Os dados ficam retidos ~90 dias (informado ao cliente) antes de eventual purga.
  const { error: updEmpresaError } = await db
    .from('empresas')
    .update({ status: 'cancelado', ativo: false, cancelado_em: new Date().toISOString() })
    .eq('id', empresaId)

  if (updEmpresaError) return { error: updEmpresaError.message }

  // Desloga o usuário e redireciona para página pública.
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login?conta=excluida')
}

const roleSchema = z.enum(['admin', 'socio', 'comercial'])

export async function createUser(
  email: string,
  password: string,
  role: string,
  fullName: string
): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const roleResult = roleSchema.safeParse(role)
  if (!roleResult.success) return { error: 'Role inválido' }
  role = roleResult.data

  const admin = createAdminClient()

  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // empresa_id no metadata: o trigger handle_new_user adiciona o membro à empresa do admin
    // (em vez de criar uma empresa nova, que é o caminho do cadastro self-serve).
    user_metadata: { full_name: fullName, role, empresa_id: empresaId },
  })

  if (createError) return { error: createError.message }

  const userId = authData.user?.id
  if (!userId) return { error: 'Erro ao criar usuário.' }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: userId, full_name: fullName, role, empresa_id: empresaId })

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: profileError.message }
  }

  revalidatePath('/configuracoes')
  return {}
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<{ error?: string }> {
  const { supabase, user: adminUser } = await getAuthAdmin()
  const adminId = adminUser.id

  if (userId === adminId) return { error: 'Não é possível alterar o próprio perfil.' }

  const roleResult = roleSchema.safeParse(role)
  if (!roleResult.success) return { error: 'Role inválido' }
  role = roleResult.data

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

export async function salvarEncarregado(
  data: unknown
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const parsed = encarregadoSchema.safeParse(data)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join('; ')
    return { error: msg }
  }

  const { error } = await supabase
    .from('empresas')
    .update({
      encarregado_nome: parsed.data.encarregado_nome ?? null,
      encarregado_email: parsed.data.encarregado_email ?? null,
      encarregado_telefone: parsed.data.encarregado_telefone ?? null,
    })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

export async function toggleModuloVisibilidade(
  modulo: string,
  ocultar: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, empresa_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Sem permissão' }

  const empresaId = profile.empresa_id as string
  const { data: empresa } = await supabase
    .from('empresas')
    .select('modulos_ocultos')
    .eq('id', empresaId)
    .single()

  const atual: string[] = empresa?.modulos_ocultos ?? []
  const novo = ocultar
    ? [...new Set([...atual, modulo])]
    : atual.filter((m) => m !== modulo)

  const { error } = await supabase
    .from('empresas')
    .update({ modulos_ocultos: novo })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const { user: adminUser } = await getAuthAdmin()
  const adminId = adminUser.id

  if (userId === adminId) return { error: 'Não é possível excluir a própria conta.' }

  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', userId)
    .single()

  if (!target || target.empresa_id !== empresaId) {
    return { error: 'Usuário não pertence a esta empresa' }
  }

  const admin = createAdminClient()

  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}
