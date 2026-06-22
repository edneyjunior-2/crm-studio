'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { randomBytes, createHash } from 'crypto'
import { createCustomer, createSubscription } from '@/lib/asaas'
import { sendInviteEmail } from '@/lib/email'

// ---------------------------------------------------------------------------
// Convite de primeiro acesso por e-mail (best-effort — nunca bloqueia a criação)
// Gera o link de recovery (mesmo do botão "Link de acesso") e envia via Resend.
// ---------------------------------------------------------------------------
async function enviarConvitePrimeiroAcesso(
  db: ReturnType<typeof createAdminClient>,
  email: string,
  nome: string,
  empresaNome: string,
): Promise<void> {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { data, error } = await db.auth.admin.generateLink({
      type:    'recovery',
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    })
    const link = data?.properties?.action_link
    if (error || !link) {
      console.error('[admin] não foi possível gerar o link de convite:', error?.message)
      return
    }
    const res = await sendInviteEmail({ to: email, nome, empresaNome, linkAcesso: link })
    if (!res.sent) {
      console.warn(`[admin] convite não enviado para ${email}: ${res.reason ?? 'desconhecido'}`)
    }
  } catch (err) {
    console.error('[admin] erro ao enviar convite de primeiro acesso:', err)
  }
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const planoSchema = z.enum(['interno', 'trial', 'starter', 'pro', 'business'])
type Plano = z.infer<typeof planoSchema>

const PLANOS_PAGOS: Plano[] = ['starter', 'pro', 'business']

// ---------------------------------------------------------------------------
// Criar empresa + usuário admin
// ---------------------------------------------------------------------------

export async function criarEmpresa(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  await getAuthPlatformAdmin()

  const nome        = (formData.get('nome') as string)?.trim()
  const email       = (formData.get('email') as string)?.trim()
  const nomeAdmin   = (formData.get('nome_admin') as string)?.trim() || nome
  const tipoPessoa  = ((formData.get('tipo_pessoa') as string) || 'pj') as 'pj' | 'pf'
  const cnpj        = (formData.get('cnpj') as string)?.trim() || undefined
  const cpf         = (formData.get('cpf') as string)?.trim() || undefined
  const documento   = tipoPessoa === 'pj' ? cnpj : cpf
  const planoRaw    = (formData.get('plano') as string) || 'trial'
  const tipoAtuacao = (formData.get('tipo_atuacao') as string) || 'vendas'
  // Módulos extras ativados por tipo de atuação
  const modulosExtras = tipoAtuacao === 'advocacia' ? ['processos'] : []

  if (!nome || !email) return { error: 'Nome e e-mail são obrigatórios.' }

  const planoResult = planoSchema.safeParse(planoRaw)
  if (!planoResult.success) return { error: 'Modalidade inválida.' }
  const plano = planoResult.data

  if (PLANOS_PAGOS.includes(plano) && !documento) {
    return { error: tipoPessoa === 'pj' ? 'CNPJ é obrigatório para planos pagos.' : 'CPF é obrigatório para planos pagos.' }
  }

  const db = createAdminClient()

  // Cria o usuário no Supabase Auth — trigger handle_new_user cria empresa + profile
  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      empresa_nome: nome,
      full_name:    nomeAdmin,
      role:         'admin',
      tipo_pessoa:  tipoPessoa,
      ...(tipoPessoa === 'pj' && cnpj ? { cnpj } : {}),
      ...(tipoPessoa === 'pf' && cpf  ? { cpf  } : {}),
    },
  })

  if (authErr) return { error: authErr.message }

  const userId = authData.user.id

  // Aguarda o trigger propagar e recupera a empresa criada
  await new Promise((r) => setTimeout(r, 500))

  const { data: profile } = await db
    .from('profiles')
    .select('empresa_id')
    .eq('id', userId)
    .single()

  if (!profile?.empresa_id) {
    await db.auth.admin.deleteUser(userId)
    return { error: 'Empresa não foi criada pelo trigger. Verifique o banco.' }
  }

  const empresaId = profile.empresa_id

  // ── Path 1: Interno — ativo imediatamente, sem Asaas ───────────────────────
  if (plano === 'interno') {
    await db
      .from('empresas')
      .update({ plano: 'interno', status: 'ativo', trial_ends_at: null, ...(modulosExtras.length ? { modulos_ativos: modulosExtras } : {}) })
      .eq('id', empresaId)

    await enviarConvitePrimeiroAcesso(db, email, nomeAdmin, nome)
    revalidatePath('/admin/empresas')
    redirect(`/admin/empresas/${empresaId}`)
  }

  // ── Path 2: Trial 7 dias — sem Asaas ───────────────────────────────────────
  if (plano === 'trial') {
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 7)
    const trialEndAt = `${trialEnd.getFullYear()}-${String(trialEnd.getMonth() + 1).padStart(2, '0')}-${String(trialEnd.getDate()).padStart(2, '0')}T23:59:59Z`

    await db
      .from('empresas')
      .update({ plano: 'trial', status: 'trial', trial_ends_at: trialEndAt, ...(modulosExtras.length ? { modulos_ativos: modulosExtras } : {}) })
      .eq('id', empresaId)

    await enviarConvitePrimeiroAcesso(db, email, nomeAdmin, nome)
    revalidatePath('/admin/empresas')
    redirect(`/admin/empresas/${empresaId}`)
  }

  // ── Path 3: Planos pagos — Asaas customer + subscription ───────────────────
  try {
    // Criar customer no Asaas (cpfCnpj aceita tanto CPF quanto CNPJ)
    const customer = await createCustomer(empresaId, nome, email, documento)

    // nextDueDate = hoje + 3 dias (prazo para o cliente pagar)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    const nextDueDate = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`

    // Criar subscription no Asaas (Asaas envia e-mail com link de pagamento)
    const subscription = await createSubscription(customer.id, plano, nextDueDate)

    // Atualizar empresa
    await db
      .from('empresas')
      .update({
        plano,
        status:            'pendente',
        trial_ends_at:     null,
        asaas_customer_id: customer.id,
        ...(modulosExtras.length ? { modulos_ativos: modulosExtras } : {}),
      })
      .eq('id', empresaId)

    // Registrar assinatura
    await db.from('assinaturas').insert({
      empresa_id:            empresaId,
      plano,
      asaas_subscription_id: subscription.id,
      status:                'pendente',
      billing_type:          subscription.billingType,
      cycle:                 'MONTHLY',
      value:                 subscription.value,
    })
  } catch (err) {
    // Rollback: remove user (cascade remove empresa + profile)
    await db.auth.admin.deleteUser(userId)
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Erro ao criar cobrança no Asaas: ${msg}` }
  }

  // Asaas OK → envia o convite de primeiro acesso (após o rollback ser descartado)
  await enviarConvitePrimeiroAcesso(db, email, nomeAdmin, nome)
  revalidatePath('/admin/empresas')
  redirect(`/admin/empresas/${empresaId}`)
}

// ---------------------------------------------------------------------------
// Atualizar status / plano de uma empresa
// ---------------------------------------------------------------------------

export async function atualizarEmpresa(empresaId: string, formData: FormData) {
  await getAuthPlatformAdmin()

  const status = formData.get('status') as string | null
  const plano  = formData.get('plano')  as string | null

  const updates: Record<string, string> = {}
  if (status) updates.status = status
  if (plano)  updates.plano  = plano

  if (!Object.keys(updates).length) return

  const db = createAdminClient()
  await db.from('empresas').update(updates).eq('id', empresaId)

  revalidatePath(`/admin/empresas/${empresaId}`)
}

// ---------------------------------------------------------------------------
// Editar o nome da empresa
// ---------------------------------------------------------------------------

export async function atualizarNomeEmpresa(
  empresaId: string,
  nome: string,
): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  const nomeTrim = nome?.trim()
  if (!nomeTrim) return { error: 'O nome não pode ficar vazio.' }
  if (nomeTrim.length > 120) return { error: 'Nome muito longo.' }

  const db = createAdminClient()
  const { error } = await db.from('empresas').update({ nome: nomeTrim }).eq('id', empresaId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/empresas/${empresaId}`)
  revalidatePath('/admin/empresas')
  return {}
}

// ---------------------------------------------------------------------------
// Sugestão de melhoria do SDR escrita pelo admin (cliente visualiza como dica)
// ---------------------------------------------------------------------------

export async function salvarSugestaoSdr(
  empresaId: string,
  sugestao: string,
): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  const db = createAdminClient()
  const { error } = await db
    .from('empresas')
    .update({ sugestao_sdr: sugestao.trim() || null })
    .eq('id', empresaId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/empresas/${empresaId}`)
  return {}
}

// ---------------------------------------------------------------------------
// Config do SDR por empresa (agenda multi-cliente): persona + tom de voz + número
// ---------------------------------------------------------------------------

export async function salvarConfigSdr(
  empresaId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  const waPhone   = (formData.get('wa_phone_number_id') as string)?.trim()
  const escritorio = (formData.get('nome_escritorio') as string)?.trim() || null
  const assistente = (formData.get('nome_assistente') as string)?.trim() || 'Leila'
  const tom        = (formData.get('tom_de_voz') as string)?.trim() || null

  if (!waPhone) return { error: 'Informe o número/ID do WhatsApp (ou um placeholder até a Meta liberar).' }

  const db = createAdminClient()

  // upsert manual: 1 config por empresa
  const { data: existente } = await db
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
    ? await db.from('clientes_sdr').update(campos).eq('id', existente.id)
    : await db.from('clientes_sdr').insert({ empresa_id: empresaId, ...campos })

  if (error) {
    if (error.code === '23505') return { error: 'Este número de WhatsApp já está vinculado a outra empresa.' }
    return { error: error.message }
  }

  revalidatePath(`/admin/empresas/${empresaId}`)
  return {}
}

// ---------------------------------------------------------------------------
// Trocar a área de atuação (CRM Vendas <-> CRM Advocacia)
// Advocacia = módulo 'processos' ativo em modulos_ativos. Vendas = sem ele.
// ---------------------------------------------------------------------------

export async function atualizarAreaAtuacao(empresaId: string, formData: FormData) {
  await getAuthPlatformAdmin()

  const area = formData.get('tipo_atuacao') as string | null
  if (area !== 'vendas' && area !== 'advocacia') return

  const db = createAdminClient()

  const { data: emp } = await db
    .from('empresas')
    .select('modulos_ativos')
    .eq('id', empresaId)
    .single()

  const atuais: string[] = emp?.modulos_ativos ?? []
  const novos =
    area === 'advocacia'
      ? atuais.includes('processos')
        ? atuais
        : [...atuais, 'processos']
      : atuais.filter((m) => m !== 'processos')

  await db.from('empresas').update({ modulos_ativos: novos }).eq('id', empresaId)

  revalidatePath(`/admin/empresas/${empresaId}`)
}

// ---------------------------------------------------------------------------
// Gerar API key para uma empresa (retorna o token UMA VEZ)
// ---------------------------------------------------------------------------

export async function gerarApiKey(
  empresaId: string,
  label: string,
): Promise<{ token: string } | { error: string }> {
  await getAuthPlatformAdmin()

  const token   = randomBytes(32).toString('hex')
  const keyHash = createHash('sha256').update(token).digest('hex')

  const db = createAdminClient()
  const { error } = await db
    .from('api_keys')
    .insert({ empresa_id: empresaId, key_hash: keyHash, label })

  if (error) return { error: error.message }

  // Linka a chave na agenda do SDR (se já houver config p/ esta empresa) — assim
  // o robô usa a chave certa no handoff. Best-effort.
  await db
    .from('clientes_sdr')
    .update({ crm_api_key: token, updated_at: new Date().toISOString() })
    .eq('empresa_id', empresaId)

  revalidatePath(`/admin/empresas/${empresaId}`)
  return { token }
}

// ---------------------------------------------------------------------------
// Gerar link de primeiro acesso (recovery) — admin copia e envia ao cliente
// ---------------------------------------------------------------------------

export async function gerarLinkAcesso(
  userId: string,
): Promise<{ error: string } | { link: string; email: string }> {
  await getAuthPlatformAdmin()

  const db = createAdminClient()

  const { data: userData } = await db.auth.admin.getUserById(userId)
  const email = userData.user?.email ?? ''
  if (!email) return { error: 'Usuário não encontrado.' }

  // redirectTo deve apontar para o app (onde o cliente define a senha).
  // A URL precisa estar na allowlist de Redirect URLs do projeto Supabase.
  // ATENÇÃO: NEXT_PUBLIC_SITE_URL pode vir como string VAZIA em produção — nesse
  // caso `?? fallback` NÃO dispara. Validar explicitamente e cair p/ a URL do app.
  const siteUrlRaw = process.env.NEXT_PUBLIC_SITE_URL
  const siteUrl =
    siteUrlRaw && (siteUrlRaw.startsWith('https://') || siteUrlRaw.startsWith('http://localhost'))
      ? siteUrlRaw
      : 'https://app.crmstudio.com.br'

  const { data, error } = await db.auth.admin.generateLink({
    type:    'recovery',
    email,
    options: { redirectTo: `${siteUrl}/reset-password` },
  })

  if (error || !data?.properties?.action_link) {
    return { error: error?.message ?? 'Não foi possível gerar o link.' }
  }

  return { link: data.properties.action_link, email }
}

// ---------------------------------------------------------------------------
// Revogar API key
// ---------------------------------------------------------------------------

export async function revogarApiKey(keyId: string, empresaId: string) {
  await getAuthPlatformAdmin()

  const db = createAdminClient()
  await db.from('api_keys').delete().eq('id', keyId).eq('empresa_id', empresaId)

  revalidatePath(`/admin/empresas/${empresaId}`)
}
