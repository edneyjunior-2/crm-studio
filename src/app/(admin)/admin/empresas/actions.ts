'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { randomBytes, createHash } from 'crypto'
import { createCustomer, createSubscription, cancelSubscription } from '@/lib/asaas'
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
  const modulosExtras =
    tipoAtuacao === 'advocacia'  ? ['processos'] :
    tipoAtuacao === 'engenharia' ? ['obras']     : []

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

  // ── Path 2: Trial 14 dias — sem Asaas ──────────────────────────────────────
  if (plano === 'trial') {
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)
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
  //
  // Ordem segura para evitar órfãos:
  //   1. Criar recursos no Asaas (customer + subscription)
  //   2. Persistir localmente (empresa + assinatura)
  //   3. Se o passo 2 falhar → rollback best-effort no Asaas, depois rollback
  //      do usuário no Auth (cascade remove empresa + profile).
  //
  // Assim nunca fica uma subscription cobrando sem empresa correspondente.

  let asaasCustomerId: string | null = null
  let asaasSubscriptionId: string | null = null

  try {
    // Criar customer no Asaas (cpfCnpj aceita tanto CPF quanto CNPJ)
    const customer = await createCustomer(empresaId, nome, email, documento)
    asaasCustomerId = customer.id

    // nextDueDate = hoje + 3 dias (prazo para o cliente pagar)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    const nextDueDate = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`

    // Criar subscription no Asaas (Asaas envia e-mail com link de pagamento)
    const subscription = await createSubscription(customer.id, plano, nextDueDate)
    asaasSubscriptionId = subscription.id

    // Persistir localmente — se qualquer operação falhar aqui, o bloco catch
    // executa rollback no Asaas antes de deletar o usuário.
    const { error: empresaUpdateErr } = await db
      .from('empresas')
      .update({
        plano,
        status:            'pendente',
        trial_ends_at:     null,
        asaas_customer_id: customer.id,
        ...(modulosExtras.length ? { modulos_ativos: modulosExtras } : {}),
      })
      .eq('id', empresaId)

    if (empresaUpdateErr) throw new Error(empresaUpdateErr.message)

    const { error: assinaturaInsertErr } = await db.from('assinaturas').insert({
      empresa_id:            empresaId,
      plano,
      asaas_subscription_id: subscription.id,
      status:                'pendente',
      billing_type:          subscription.billingType,
      cycle:                 'MONTHLY',
      value:                 subscription.value,
    })

    if (assinaturaInsertErr) throw new Error(assinaturaInsertErr.message)
  } catch (err) {
    // Rollback best-effort no Asaas para não deixar subscription cobrando sem empresa
    if (asaasSubscriptionId) {
      cancelSubscription(asaasSubscriptionId).catch((e: unknown) => {
        console.error('[criarEmpresa] falha ao cancelar subscription órfã no Asaas:', e)
      })
    }
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

export async function atualizarEmpresa(
  empresaId: string,
  formData: FormData,
): Promise<void> {
  await getAuthPlatformAdmin()

  const status = formData.get('status') as string | null
  const plano  = formData.get('plano')  as string | null

  const updates: Record<string, string> = {}
  if (status) updates.status = status
  if (plano)  updates.plano  = plano

  if (!Object.keys(updates).length) return

  const db = createAdminClient()
  const { error } = await db.from('empresas').update(updates).eq('id', empresaId)
  if (error) { console.error('atualizarEmpresa:', error.message); return }

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
// Trocar a área de atuação (Vendas | Advocacia | Engenharia)
// Cada vertical controla um módulo em modulos_ativos:
//   advocacia  → 'processos'
//   engenharia → 'obras'
//   vendas     → nenhum extra
// ---------------------------------------------------------------------------

export async function atualizarAreaAtuacao(
  empresaId: string,
  formData: FormData,
): Promise<void> {
  await getAuthPlatformAdmin()

  const area = formData.get('tipo_atuacao') as string | null
  if (area !== 'vendas' && area !== 'advocacia' && area !== 'engenharia') return

  const db = createAdminClient()

  const { data: emp, error: readErr } = await db
    .from('empresas')
    .select('modulos_ativos')
    .eq('id', empresaId)
    .single()

  // Se a leitura falhar, NÃO prosseguir: usar `?? []` aqui zeraria os módulos
  // existentes (perderíamos os módulos não-verticais já ativos da empresa).
  if (readErr) { console.error('atualizarAreaAtuacao (read):', readErr.message); return }

  // Remove módulos verticais anteriores e adiciona o novo
  let novos: string[] = (emp?.modulos_ativos ?? []).filter(
    (m: string) => m !== 'processos' && m !== 'obras',
  )

  if (area === 'advocacia')  novos = [...novos, 'processos']
  if (area === 'engenharia') novos = [...novos, 'obras']

  const { error } = await db.from('empresas').update({ modulos_ativos: novos }).eq('id', empresaId)
  if (error) { console.error('atualizarAreaAtuacao (update):', error.message); return }

  revalidatePath(`/admin/empresas/${empresaId}`)
}

// ---------------------------------------------------------------------------
// Valor da mensalidade acordado (cobrança feita fora do sistema)
// ---------------------------------------------------------------------------

export async function salvarValorMensalidade(
  empresaId: string,
  formData: FormData,
): Promise<void> {
  await getAuthPlatformAdmin()

  const rawValor = (formData.get('valor_mensalidade') as string ?? '').replace(/\./g, '').replace(',', '.')
  const valor = parseFloat(rawValor)
  if (isNaN(valor) || valor < 0) { console.warn('salvarValorMensalidade: valor inválido', rawValor); return }

  const db = createAdminClient()
  const { error } = await db.from('empresas').update({ valor_mensalidade: valor }).eq('id', empresaId)
  if (error) { console.error('salvarValorMensalidade:', error.message); return }

  revalidatePath(`/admin/empresas/${empresaId}`)
  revalidatePath('/admin')
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
// Remover usuário de uma empresa (deleta profile + auth user)
// ---------------------------------------------------------------------------

export async function removerUsuario(
  userId: string,
  empresaId: string,
): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  const db = createAdminClient()

  // Proteger: não permitir remover o último admin da empresa
  const { data: admins } = await db
    .from('profiles')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('role', 'admin')

  if ((admins?.length ?? 0) <= 1) {
    const { data: target } = await db.from('profiles').select('role').eq('id', userId).single()
    if (target?.role === 'admin') {
      return { error: 'Não é possível remover o único administrador da empresa.' }
    }
  }

  // Deletar profile (FK cascade limpa registros dependentes)
  const { error: profileErr } = await db.from('profiles').delete().eq('id', userId).eq('empresa_id', empresaId)
  if (profileErr) return { error: profileErr.message }

  // Deletar auth user
  const { error: authErr } = await db.auth.admin.deleteUser(userId)
  if (authErr) return { error: authErr.message }

  revalidatePath(`/admin/empresas/${empresaId}`)
  return {}
}

// ---------------------------------------------------------------------------
// Reenviar convite por e-mail (gera novo link + envia Resend)
// ---------------------------------------------------------------------------

export async function reenviarConviteEmail(
  userId: string,
  empresaId: string,
): Promise<{ sent: boolean; email?: string; error?: string }> {
  await getAuthPlatformAdmin()

  const db = createAdminClient()

  // NÃO usar db.auth.admin.getUserById() — GoTrue falha/retorna vazio em prod
  // neste projeto Supabase. Ler o e-mail da VIEW profiles_auth (service role).
  const [{ data: authRow }, { data: empresa }, { data: profile }] = await Promise.all([
    db.from('profiles_auth').select('id, email').eq('id', userId).maybeSingle(),
    db.from('empresas').select('nome').eq('id', empresaId).single(),
    db.from('profiles').select('full_name').eq('id', userId).single(),
  ])

  const email = authRow?.email ?? ''
  if (!email) return { sent: false, error: 'Usuário não encontrado.' }

  const nome       = profile?.full_name ?? email
  const empresaNome = empresa?.nome ?? 'CRM Studio'

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
    return { sent: false, error: error?.message ?? 'Não foi possível gerar o link.' }
  }

  const res = await sendInviteEmail({ to: email, nome, empresaNome, linkAcesso: data.properties.action_link })
  if (!res.sent) return { sent: false, error: res.reason ?? 'Falha ao enviar.' }

  return { sent: true, email }
}

// ---------------------------------------------------------------------------
// Gerar link de primeiro acesso (recovery) — admin copia e envia ao cliente
// ---------------------------------------------------------------------------

export async function gerarLinkAcesso(
  userId: string,
): Promise<{ error: string } | { link: string; email: string }> {
  await getAuthPlatformAdmin()

  const db = createAdminClient()

  // NÃO usar db.auth.admin.getUserById() — GoTrue falha/retorna vazio em prod
  // neste projeto Supabase. Ler o e-mail da VIEW profiles_auth (service role).
  const { data: authRow } = await db.from('profiles_auth').select('id, email').eq('id', userId).maybeSingle()
  const email = authRow?.email ?? ''
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
// Modelo de contrato — upload e liberação (Fase 1 white-label)
// ---------------------------------------------------------------------------

/**
 * Sobe um arquivo .html como modelo de contrato para o bucket privado
 * `contrato-templates/<empresaId>/index.html` e seta config.contrato_template_path.
 * Limite: 2 MB, somente text/html.
 */
export async function salvarModeloContrato(
  empresaId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  const file = formData.get('modelo') as File | null
  if (!file) return { error: 'Nenhum arquivo enviado.' }
  if (file.size > 2 * 1024 * 1024) return { error: 'Arquivo muito grande. Limite: 2 MB.' }
  if (file.type !== 'text/html' && !file.name.endsWith('.html')) {
    return { error: 'Somente arquivos .html são aceitos.' }
  }

  const db = createAdminClient()
  const path = `${empresaId}/index.html`

  const { error: upErr } = await db.storage
    .from('contrato-templates')
    .upload(path, file, { upsert: true, contentType: 'text/html' })

  if (upErr) return { error: upErr.message }

  // Merge do config existente — não sobrescreve outras chaves
  const { data: emp } = await db
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .single()

  const configAtual = (emp?.config as Record<string, unknown> | null) ?? {}
  const novoConfig = { ...configAtual, contrato_template_path: path }

  const { error: dbErr } = await db
    .from('empresas')
    .update({ config: novoConfig })
    .eq('id', empresaId)

  if (dbErr) return { error: dbErr.message }

  revalidatePath(`/admin/empresas/${empresaId}`)
  return {}
}

/**
 * Seta config.contrato_aprovado (merge) — libera ou revoga o modelo para o tenant.
 */
export async function liberarModeloContrato(
  empresaId: string,
  aprovado: boolean,
): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  const db = createAdminClient()

  const { data: emp } = await db
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .single()

  const configAtual = (emp?.config as Record<string, unknown> | null) ?? {}
  const novoConfig = { ...configAtual, contrato_aprovado: aprovado }

  const { error } = await db
    .from('empresas')
    .update({ config: novoConfig })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/empresas/${empresaId}`)
  return {}
}

/**
 * Seta config.contrato_nivel_assinatura (merge) — modalidade de assinatura
 * eletrônica usada pelo ZapSign para os contratos desta empresa ('simples'
 * default quando ausente do jsonb). Só modalidades gratuitas (simples/email/
 * sms) + qualificada (paga, deliberada) são aceitas — nunca WhatsApp/biometria.
 * Advocacia tende a usar 'qualificada' (ônus da prova).
 */
export async function salvarNivelAssinatura(
  empresaId: string,
  nivel: 'simples' | 'email' | 'sms' | 'qualificada',
): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  const db = createAdminClient()

  const { data: emp } = await db
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .single()

  const configAtual = (emp?.config as Record<string, unknown> | null) ?? {}
  const novoConfig = { ...configAtual, contrato_nivel_assinatura: nivel }

  const { error } = await db
    .from('empresas')
    .update({ config: novoConfig })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/empresas/${empresaId}`)
  return {}
}

/**
 * Seta config.contrato_signatario_nome/_email (merge) — quem assina os
 * contratos EM NOME DESTA EMPRESA (o CONTRATADO). O contrato tem linha de
 * assinatura pros dois lados, então essa pessoa é adicionada como signatário
 * em todo envio pro ZapSign, junto com a contraparte, e recebe o próprio link
 * por e-mail (ver enviarParaAssinatura em src/app/(crm)/contratos/actions.ts).
 * Ambos vazios = só a contraparte assina eletronicamente.
 */
export async function salvarSignatarioEmpresa(
  empresaId: string,
  signatario: { nome: string; email: string },
): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  const nome  = signatario.nome.trim()
  const email = signatario.email.trim()

  // Os dois juntos ou nenhum: um signatário sem e-mail não recebe o link de
  // assinatura, e um e-mail sem nome não identifica quem assinou no documento.
  if ((nome && !email) || (!nome && email)) {
    return { error: 'Informe nome e e-mail do signatário — ou deixe os dois em branco.' }
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'E-mail do signatário inválido.' }
  }

  const db = createAdminClient()

  const { data: emp } = await db
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .single()

  const configAtual = (emp?.config as Record<string, unknown> | null) ?? {}
  const novoConfig = {
    ...configAtual,
    contrato_signatario_nome:  nome || null,
    contrato_signatario_email: email || null,
  }

  const { error } = await db
    .from('empresas')
    .update({ config: novoConfig })
    .eq('id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/empresas/${empresaId}`)
  return {}
}

// ---------------------------------------------------------------------------
// Revogar API key
// ---------------------------------------------------------------------------

export async function revogarApiKey(
  keyId: string,
  empresaId: string,
): Promise<void> {
  await getAuthPlatformAdmin()

  const db = createAdminClient()
  const { error } = await db.from('api_keys').delete().eq('id', keyId).eq('empresa_id', empresaId)
  if (error) { console.error('revogarApiKey:', error.message); return }

  revalidatePath(`/admin/empresas/${empresaId}`)
}
