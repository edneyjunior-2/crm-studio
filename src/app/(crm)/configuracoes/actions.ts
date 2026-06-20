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
  role: string,
  fullName: string
): Promise<{ error?: string }> {
  const { supabase, user: adminUser, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const roleResult = roleSchema.safeParse(role)
  if (!roleResult.success) return { error: 'Role inválido' }
  role = roleResult.data

  const admin = createAdminClient()

  const [{ data: adminProfile }, { data: empresa }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', adminUser.id).single(),
    admin.from('empresas').select('nome').eq('id', empresaId).single(),
  ])

  // generateLink gera o link de convite sem disparar e-mail automático.
  // Enviamos nós mesmos via Resend com conteúdo personalizado.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName, role, empresa_id: empresaId } },
  })

  if (linkError) return { error: linkError.message }

  const userId = linkData.user?.id
  const actionLink = linkData.properties?.action_link
  if (!userId || !actionLink) return { error: 'Erro ao gerar convite.' }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: userId, full_name: fullName, role, empresa_id: empresaId })

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: profileError.message }
  }

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const FROM = process.env.EMAIL_FROM ?? 'CRM Studio <nao-responda@crmstudio.com.br>'
    const adminName = adminProfile?.full_name ?? 'Administrador'
    const empresaNome = empresa?.nome ?? 'CRM Studio'

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `${adminName} convidou você para o CRM Studio`,
      html: buildInviteHtml({ adminName, empresaNome, inviteLink: actionLink, fullName }),
    })
  }

  revalidatePath('/configuracoes')
  return {}
}

const NAVY  = '#14233A'
const AMBER = '#E8915B'
const BONE  = '#ECEAE3'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildInviteHtml({
  adminName,
  empresaNome,
  inviteLink,
  fullName,
}: {
  adminName: string
  empresaNome: string
  inviteLink: string
  fullName: string
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Convite — crm studio.</title></head>
<body style="margin:0;padding:0;background:${BONE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BONE};padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <tr><td style="background:${NAVY};padding:28px 32px;text-align:center;">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">crm studio<span style="color:${AMBER};">.</span></span>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${NAVY};">Olá, ${esc(fullName)}!</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
          <strong style="color:${NAVY};">${esc(adminName)}</strong> de <strong style="color:${NAVY};">${esc(empresaNome)}</strong> convidou você para acessar o <strong style="color:${NAVY};">crm studio.</strong><br>
          Clique no botão abaixo para definir sua senha e começar a usar.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="background:${AMBER};border-radius:8px;">
            <a href="${inviteLink}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
              Aceitar convite →
            </a>
          </td></tr>
        </table>
        <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">Se o botão não funcionar, copie e cole este link:</p>
        <p style="margin:0;font-size:12px;color:${AMBER};word-break:break-all;">${inviteLink}</p>
      </td></tr>
      <tr><td style="background:#f8f7f4;border-top:1px solid #e5e2da;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">
          Este convite expira em 24 horas. Se você não esperava receber este e-mail, pode ignorá-lo com segurança.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
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
