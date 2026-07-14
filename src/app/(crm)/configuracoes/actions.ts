'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthAdmin, getAuthUser } from '@/lib/auth'
import type { StatusEmpresa } from '@/lib/auth'
import { cancelSubscription } from '@/lib/asaas'
import { encarregadoSchema } from '@/lib/schemas'
import { MODULOS, LIMITES_POR_PLANO } from '@/lib/modulos'
import { appUrl } from '@/lib/site-url'
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
  // Garante que o chamador autenticado pode agir sobre a empresa solicitada
  // (protege invocação remota). NÃO relemos profiles.empresa_id aqui: para
  // platform admin esse campo é o tenant FIXO, enquanto getAuthUser() já resolve
  // o tenant EFETIVO (empresa_ativa_id p/ platform admin, empresa_id p/ comum).
  // Comparar contra o tenant fixo bloquearia o platform admin no tenant ativo.
  const { empresaId: empresaIdEfetivo } = await getAuthUser()
  // Autoriza pelo tenant EFETIVO, que já é o ativo p/ platform admin e o próprio
  // p/ usuário comum. Assim o platform admin age sobre o tenant ativo, e o admin
  // comum só sobre o seu — sem nunca usar o tenant fixo do platform admin.
  if (empresaIdEfetivo !== empresaId) throw new Error('Sem permissão.')

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

const roleSchema = z.enum(['admin', 'socio', 'comercial', 'parceiro'])

export async function createUser(
  email: string,
  role: string,
  fullName: string
): Promise<{ error?: string; warning?: string }> {
  const { supabase, user: adminUser, empresaId, plano } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const roleResult = roleSchema.safeParse(role)
  if (!roleResult.success) return { error: 'Role inválido' }
  role = roleResult.data

  // Parceiro é um usuário EXTERNO — a RBAC por usuário (modulos_permitidos)
  // restringe o menu a Processos. A fronteira real é a RLS (parceiro_id =
  // auth.uid() em processos_juridicos + zero acesso às tabelas-filhas), mas
  // travar o menu aqui evita a UI confusa de mostrar módulos inacessíveis.
  const modulosPermitidosConvite = role === 'parceiro' ? ['processos'] : undefined

  // Limite de plano: conta usuários (profiles) da empresa. -1 = ilimitado.
  const limiteUsuarios = LIMITES_POR_PLANO[plano].usuarios
  if (limiteUsuarios !== -1) {
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
    if (countError) return { error: countError.message }
    if ((count ?? 0) >= limiteUsuarios) {
      // Mensagem tem que dizer PARA ONDE ir — "faça upgrade" sozinho manda a
      // pessoa procurar. O Business é o único plano sem teto de usuários.
      return {
        error: `Seu plano inclui ${limiteUsuarios} usuários e eles já estão todos ocupados. Para crescer o time, mude para o Business (usuários ilimitados) em Configurações › Assinatura.`,
      }
    }
  }

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
  if (!userId) return { error: 'Erro ao criar o usuário.' }

  // Segurança multi-tenant: se o e-mail já existir no Auth com convite PENDENTE
  // de OUTRA empresa, generateLink({type:'invite'}) devolve o MESMO userId (não
  // cria um novo). Sem esta checagem, o upsert abaixo SOBRESCREVERIA o profile
  // já existente (empresa_id/role/nome), sequestrando o usuário de outra
  // empresa. Mesmo guard já usado em reenviarConvite.
  const { data: profileExistente } = await admin
    .from('profiles')
    .select('empresa_id')
    .eq('id', userId)
    .maybeSingle()

  if (profileExistente && profileExistente.empresa_id && profileExistente.empresa_id !== empresaId) {
    return { error: 'Este e-mail já pertence a outra empresa.' }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: userId,
      full_name: fullName,
      role,
      empresa_id: empresaId,
      ...(modulosPermitidosConvite ? { modulos_permitidos: modulosPermitidosConvite } : {}),
    })

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: profileError.message }
  }

  if (process.env.RESEND_API_KEY) {
    // Link de ACESSO = 'recovery' → /reset-password (a tela que define a senha).
    // O action_link do 'invite' NÃO leva a essa tela, então o convidado ficava
    // sem como criar a senha (bug). recovery é válido p/ o usuário recém-criado
    // e é o mesmo caminho usado por reenviarConvite.
    const { data: recoveryData, error: recoveryError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${appUrl()}/reset-password` },
    })
    if (recoveryError) return { error: recoveryError.message }
    const actionLink = recoveryData.properties?.action_link
    if (!actionLink) return { error: 'Erro ao gerar o link de acesso.' }

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const FROM = process.env.EMAIL_FROM ?? 'CRM Studio <nao-responda@crmstudio.com.br>'
    const adminName = adminProfile?.full_name ?? 'Administrador'
    const empresaNome = empresa?.nome ?? 'CRM Studio'

    const { error: mailErr } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: `${adminName} convidou você para o CRM Studio`,
      html: buildInviteHtml({ adminName, empresaNome, inviteLink: actionLink, fullName }),
    })
    if (mailErr) {
      revalidatePath('/configuracoes')
      return { warning: 'Usuário criado, mas o e-mail de convite falhou — reenvie o convite manualmente.' }
    }
  }

  revalidatePath('/configuracoes')
  return {}
}

/**
 * Reenvia o convite de acesso para um usuário JÁ existente da mesma empresa.
 * Como o usuário já existe no Auth, usa um link de 'recovery' (definir/redefinir
 * senha → acessa o CRM) em vez de 'invite' (que só vale p/ e-mail novo).
 */
export async function reenviarConvite(userId: string): Promise<{ error?: string }> {
  const { supabase, user: adminUser, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const admin = createAdminClient()

  // Segurança multi-tenant: o alvo precisa ser da mesma empresa do admin.
  const { data: alvo } = await admin
    .from('profiles')
    .select('full_name, empresa_id')
    .eq('id', userId)
    .single()
  if (!alvo || alvo.empresa_id !== empresaId) {
    return { error: 'Usuário não encontrado nesta empresa.' }
  }

  // GOTCHA: admin.auth.admin.getUserById() (GoTrue) falha/retorna vazio em prod
  // neste projeto — ler da view profiles_auth (service-role) em vez do GoTrue.
  const { data: authRow } = await admin
    .from('profiles_auth')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  const email = authRow?.email
  if (!email) return { error: 'E-mail do usuário não encontrado.' }

  if (!process.env.RESEND_API_KEY) {
    return { error: 'Envio de e-mail não está configurado no servidor.' }
  }

  // Link de acesso (definir senha) — válido para usuário já existente.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${appUrl()}/reset-password`,
    },
  })
  if (linkError) return { error: linkError.message }
  const actionLink = linkData.properties?.action_link
  if (!actionLink) return { error: 'Erro ao gerar o link de convite.' }

  const [{ data: adminProfile }, { data: empresa }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', adminUser.id).single(),
    admin.from('empresas').select('nome').eq('id', empresaId).single(),
  ])

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const FROM = process.env.EMAIL_FROM ?? 'CRM Studio <nao-responda@crmstudio.com.br>'
  const adminName = adminProfile?.full_name ?? 'Administrador'
  const empresaNome = empresa?.nome ?? 'CRM Studio'

  const { error: sendErr } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${adminName} reenviou seu convite para o CRM Studio`,
    html: buildInviteHtml({ adminName, empresaNome, inviteLink: actionLink, fullName: alvo.full_name ?? '' }),
  })
  if (sendErr) return { error: 'Falha ao enviar o e-mail. Tente novamente.' }

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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Convite — CRM Studio.</title></head>
<body style="margin:0;padding:0;background:${BONE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BONE};padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <tr><td style="background:${NAVY};padding:28px 32px;text-align:center;">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">CRM Studio<span style="color:${AMBER};">.</span></span>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${NAVY};">Olá, ${esc(fullName)}!</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
          <strong style="color:${NAVY};">${esc(adminName)}</strong> de <strong style="color:${NAVY};">${esc(empresaNome)}</strong> convidou você para acessar o <strong style="color:${NAVY};">CRM Studio.</strong><br>
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
  const { supabase, user: adminUser, empresaId } = await getAuthAdmin()
  const adminId = adminUser.id

  if (userId === adminId) return { error: 'Não é possível alterar o próprio perfil.' }

  const roleResult = roleSchema.safeParse(role)
  if (!roleResult.success) return { error: 'Role inválido' }
  role = roleResult.data

  // Garante que o usuário alvo pertence à mesma empresa
  const { data: target } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', userId)
    .single()
  if (!target || target.empresa_id !== empresaId) return { error: 'Usuário não encontrado.' }

  // Virou parceiro (externo): trava o menu em Processos mesmo que antes tivesse
  // acesso mais amplo (ou nenhuma restrição). Mesma lógica do convite direto —
  // ver createUser. A RLS é quem garante o isolamento de dado; isto é só o menu.
  const updatePayload: { role: string; modulos_permitidos?: string[] } = { role }
  if (role === 'parceiro') updatePayload.modulos_permitidos = ['processos']

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

export async function updateUserNome(
  userId: string,
  nome: string,
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()

  const nomeTrimmed = nome.trim().slice(0, 120)
  if (!nomeTrimmed) return { error: 'O nome não pode ficar em branco.' }

  // Garante que o usuário alvo pertence à mesma empresa
  const { data: target } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', userId)
    .single()
  if (!target || target.empresa_id !== empresaId) return { error: 'Usuário não encontrado.' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: nomeTrimmed })
    .eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

export async function updateUserCargo(
  userId: string,
  cargo: string,
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()

  // Garante que o usuário alvo pertence à mesma empresa
  const { data: target } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', userId)
    .single()
  if (!target || target.empresa_id !== empresaId) return { error: 'Usuário não encontrado.' }

  const cargoTrimmed = cargo.trim().slice(0, 80)
  const { error } = await supabase
    .from('profiles')
    .update({ cargo: cargoTrimmed || null })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/configuracoes')
  revalidatePath('/processos/responsabilidades')
  return {}
}

/** RBAC: define quais módulos um usuário pode acessar. null = sem restrição (vê tudo). */
export async function salvarModulosUsuario(
  userId: string,
  modulos: string[] | null,
): Promise<{ error?: string }> {
  const { supabase, user: adminUser, empresaId } = await getAuthAdmin()
  if (userId === adminUser.id) return { error: 'Você sempre tem acesso total.' }

  if (modulos != null) {
    const validos = new Set<string>(MODULOS)
    if (!modulos.every((m) => validos.has(m))) return { error: 'Módulo inválido.' }
  }

  // Alvo deve ser da mesma empresa; admin é sempre full (não editável).
  const { data: target } = await supabase
    .from('profiles')
    .select('empresa_id, role')
    .eq('id', userId)
    .single()
  if (!target || target.empresa_id !== empresaId) return { error: 'Usuário não encontrado.' }
  if (target.role === 'admin') return { error: 'Administrador sempre tem acesso total.' }

  const { error } = await supabase
    .from('profiles')
    .update({ modulos_permitidos: modulos })
    .eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

export async function salvarDadosEmpresa(dados: {
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string | null
}): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  // UPDATE em empresas foi revogado de `authenticated`
  // (20260703130000_protege_billing_empresas.sql) — precisa de service-role.
  const { error } = await createAdminClient()
    .from('empresas')
    .update({
      razao_social:  dados.razao_social?.trim()  || null,
      nome_fantasia: dados.nome_fantasia?.trim() || null,
      cnpj:          dados.cnpj?.trim()          || null,
    })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  return {}
}

// ---------------------------------------------------------------------------
// Timbrado (cabeçalho institucional) — bucket privado + path em empresas.config
// ---------------------------------------------------------------------------
const TIMBRADO_BUCKET = 'timbrados'
const TIMBRADO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const TIMBRADO_TIPOS = ['image/png', 'image/jpeg']

/**
 * Sobe o timbrado (PNG/JPG) da empresa do admin autenticado e grava o path em
 * `empresas.config.timbrado_path` (merge, sem apagar outras chaves).
 *
 * GOTCHA billing: `UPDATE` em `empresas` foi revogado de `authenticated`
 * (20260703130000_protege_billing_empresas.sql) — por isso grava via
 * `createAdminClient()` (service-role), nunca via client do usuário. O escopo
 * multi-tenant vem de `getAuthAdmin().empresaId` (tenant efetivo).
 */
export async function salvarTimbrado(formData: FormData): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const file = formData.get('timbrado') as File | null
  if (!file || file.size === 0) return { error: 'Nenhum arquivo enviado.' }
  if (file.size > TIMBRADO_MAX_BYTES) return { error: 'Imagem muito grande. Limite: 2 MB.' }
  if (!TIMBRADO_TIPOS.includes(file.type)) return { error: 'Formato inválido. Use PNG ou JPG.' }

  const db = createAdminClient()
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${empresaId}/timbrado.${ext}`

  // Remove a variante de extensão antiga (evita órfão ao trocar png<->jpg).
  // Best-effort: erro de "não existe" é esperado e ignorado.
  await db.storage
    .from(TIMBRADO_BUCKET)
    .remove([`${empresaId}/timbrado.png`, `${empresaId}/timbrado.jpg`])

  const { error: upErr } = await db.storage
    .from(TIMBRADO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) return { error: upErr.message }

  const { data: emp } = await db.from('empresas').select('config').eq('id', empresaId).single()
  const configAtual = (emp?.config as Record<string, unknown> | null) ?? {}
  const novoConfig = { ...configAtual, timbrado_path: path }

  const { error: dbErr } = await db.from('empresas').update({ config: novoConfig }).eq('id', empresaId)
  if (dbErr) return { error: dbErr.message }

  revalidatePath('/configuracoes')
  return {}
}

/** Remove o timbrado atual (storage + chave `timbrado_path` do config). */
export async function removerTimbrado(): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const db = createAdminClient()

  // Best-effort: remove qualquer extensão presente.
  await db.storage
    .from(TIMBRADO_BUCKET)
    .remove([`${empresaId}/timbrado.png`, `${empresaId}/timbrado.jpg`])

  const { data: emp } = await db.from('empresas').select('config').eq('id', empresaId).single()
  const novoConfig = { ...((emp?.config as Record<string, unknown> | null) ?? {}) }
  delete novoConfig.timbrado_path

  const { error: dbErr } = await db.from('empresas').update({ config: novoConfig }).eq('id', empresaId)
  if (dbErr) return { error: dbErr.message }

  revalidatePath('/configuracoes')
  return {}
}

/**
 * Busca a signed URL do timbrado atual da empresa do admin autenticado.
 * Existe para a seção de config em Configurações se auto-buscar (a página
 * `configuracoes/page.tsx` não é tocada por esta spec).
 */
export async function obterTimbradoAtual(): Promise<{ url: string | null }> {
  const { empresaId } = await getAuthAdmin()
  const { resolverTimbradoUrl } = await import('@/lib/timbrado')
  return { url: await resolverTimbradoUrl(empresaId) }
}

export async function salvarEncarregado(
  data: unknown
): Promise<{ error?: string }> {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const parsed = encarregadoSchema.safeParse(data)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join('; ')
    return { error: msg }
  }

  // UPDATE em empresas foi revogado de `authenticated`
  // (20260703130000_protege_billing_empresas.sql) — precisa de service-role.
  const { error } = await createAdminClient()
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
  // getAuthAdmin já valida a role 'admin' (redireciona) e resolve o tenant
  // EFETIVO (empresa_ativa_id p/ platform admin, empresa_id p/ usuário comum).
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  // UPDATE em empresas foi revogado de `authenticated`
  // (20260703130000_protege_billing_empresas.sql) — precisa de service-role.
  const db = createAdminClient()

  const { data: empresa } = await db
    .from('empresas')
    .select('modulos_ocultos')
    .eq('id', empresaId)
    .single()

  const atual: string[] = empresa?.modulos_ocultos ?? []
  const novo = ocultar
    ? [...new Set([...atual, modulo])]
    : atual.filter((m) => m !== modulo)

  const { error } = await db
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

// ---------------------------------------------------------------------------
// Config SDR — salva na empresa do usuário logado
// ---------------------------------------------------------------------------
export async function salvarConfigSdrEmpresa(formData: FormData) {
  const { empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const waPhone    = (formData.get('wa_phone_number_id') as string)?.trim()
  const escritorio = (formData.get('nome_escritorio')    as string)?.trim() || null
  const assistente = (formData.get('nome_assistente')    as string)?.trim() || 'Leila'
  const tom        = (formData.get('tom_de_voz')         as string)?.trim() || null

  if (!waPhone) return { error: 'Informe o número/ID do WhatsApp (phone_number_id da Meta).' }

  const admin = createAdminClient()

  // upsert manual: 1 config de SDR por empresa, na MESMA tabela que o bot lê (clientes_sdr)
  const { data: existente } = await admin
    .from('clientes_sdr')
    .select('id')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  const campos = {
    wa_phone_number_id: waPhone,
    nome_escritorio:    escritorio,
    nome_assistente:    assistente,
    tom_de_voz:         tom,
    updated_at:         new Date().toISOString(),
  }

  const { error } = existente?.id
    ? await admin.from('clientes_sdr').update(campos).eq('id', existente.id)
    : await admin.from('clientes_sdr').insert({ empresa_id: empresaId, ...campos })

  if (error) {
    if (error.code === '23505') return { error: 'Este número de WhatsApp já está vinculado a outra empresa.' }
    return { error: error.message }
  }

  revalidatePath('/configuracoes')
  return {}
}
