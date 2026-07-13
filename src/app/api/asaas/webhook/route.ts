import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cancelSubscription } from '@/lib/asaas'
import { sendAlertaInterno, sendAcessoLiberadoEmail } from '@/lib/email'
import { appUrl } from '@/lib/site-url'
import { timingSafeEqual, createHash } from 'crypto'

const ALERTA_EMAIL = process.env.ALERTA_EMAIL ?? 'edneyjuniords@gmail.com'

// ---------------------------------------------------------------------------
// Tipos do payload Asaas
// ---------------------------------------------------------------------------

interface AsaasPaymentPayload {
  id:           string       // pay_...
  customer:     string       // cus_...
  subscription?: string      // sub_...
  status:       string
  value:        number
  dueDate:      string
  paymentDate?: string
  billingType:  string
  invoiceUrl?:  string
}

interface AsaasSubscriptionPayload {
  id:                 string          // sub_...
  customer:           string          // cus_...
  status?:            string
  // Setado por nós na criação do Checkout (createCheckout, externalReference
  // = empresaId) — ver src/app/(marketing)/cadastro/pagamento/actions.ts.
  // Usado como atalho de resolução em SUBSCRIPTION_CREATED (ver seção 4).
  externalReference?: string
}

interface AsaasWebhookBody {
  id:            string       // evt_... — chave de idempotência
  event:         string       // PAYMENT_RECEIVED, SUBSCRIPTION_DELETED, etc.
  payment?:      AsaasPaymentPayload       // presente nos eventos PAYMENT_*
  subscription?: AsaasSubscriptionPayload  // presente nos eventos SUBSCRIPTION_*
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const ha = createHash('sha256').update(a).digest()
    const hb = createHash('sha256').update(b).digest()
    return timingSafeEqual(ha, hb)
  } catch {
    return false
  }
}

function faturasStatusFromEvent(event: string): string | null {
  switch (event) {
    case 'PAYMENT_CONFIRMED':            return 'confirmada'
    case 'PAYMENT_RECEIVED':             return 'recebida'
    case 'PAYMENT_OVERDUE':              return 'vencida'
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_PARTIALLY_REFUNDED':   return 'estornada'
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_CHARGEBACK_DISPUTE':   return 'chargeback'
    case 'PAYMENT_DELETED':              return 'removida'
    default:                             return null
  }
}

/**
 * E-mail de acesso liberado (spec onboarding-senha-pos-pagamento.md, Parte B),
 * disparado só na transição real pendente_cartao → trial. Best-effort: quem
 * chama trata qualquer rejeição com `.catch()` — nunca deve derrubar o
 * processamento do evento (mesmo padrão do sendAlertaInterno usado acima).
 *
 * GOTCHA confirmado ao ler o código: a view `profiles_auth` (ver
 * 20260629160000_profiles_auth_view.sql) só expõe `id, email,
 * last_sign_in_at` — NÃO tem `empresa_id`, `role` nem `full_name`. Por isso o
 * fundador é resolvido em `profiles` (que tem essas colunas) primeiro, e o
 * e-mail é lido depois na view (mesmo padrão de reenviarConviteEmail em
 * src/app/(admin)/admin/empresas/actions.ts).
 */
async function enviarEmailAcessoLiberado(
  supabase: ReturnType<typeof createAdminClient>,
  empresaId: string,
): Promise<void> {
  const { data: fundador } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('empresa_id', empresaId)
    .eq('role', 'admin')
    .maybeSingle()
  if (!fundador) return

  const { data: authRow } = await supabase
    .from('profiles_auth')
    .select('email')
    .eq('id', fundador.id)
    .maybeSingle()
  const email = authRow?.email
  if (!email) return

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${appUrl()}/reset-password` },
  })
  const link = linkData?.properties?.action_link
  if (linkErr || !link) {
    console.error('[webhook] falha ao gerar link de acesso pós-pagamento:', linkErr?.message)
    return
  }

  await sendAcessoLiberadoEmail({ to: email, nome: fundador.full_name ?? email, linkAcesso: link })
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN
  if (!webhookToken) {
    console.error('[webhook] ASAAS_WEBHOOK_TOKEN não configurado')
    return NextResponse.json({ error: 'Configuração interna ausente' }, { status: 500 })
  }

  // 1. Validar token (timing-safe)
  const receivedToken = request.headers.get('asaas-access-token') ?? ''
  if (!timingSafeCompare(receivedToken, webhookToken)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // 2. Parse do body
  let body: AsaasWebhookBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const { id: asaasEventId, event, payment, subscription } = body

  // Eventos SUBSCRIPTION_* trazem body.subscription (não body.payment).
  // Os demais (PAYMENT_*) trazem body.payment. Ramificamos por prefixo do
  // evento para não exigir payment.id em cancelamentos de assinatura.
  const isSubscriptionEvent = typeof event === 'string' && event.startsWith('SUBSCRIPTION_')

  if (!asaasEventId || !event) {
    return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 })
  }

  if (isSubscriptionEvent) {
    if (!subscription?.id) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 })
    }
  } else if (!payment?.id) {
    return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 3. Idempotência — inserir evento; se conflito, já processado → 200
  const { error: insertErr } = await supabase
    .from('eventos_webhook')
    .insert({
      asaas_event_id:   asaasEventId,
      event,
      asaas_payment_id: payment?.id ?? null,
      payload:          body,
    })

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Evento duplicado — idempotente
      return NextResponse.json({ ok: true, duplicate: true })
    }
    // Erro inesperado ao gravar — retornar 500 para o Asaas reenviar
    console.error('[webhook] Erro inesperado ao inserir evento (code=%s)', insertErr.code)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  // 4. Resolver empresa_id
  // Em eventos SUBSCRIPTION_*, a chave é subscription.id; nos PAYMENT_*,
  // payment.subscription. O fallback por customer usa o customer do payload
  // correspondente.
  const subscriptionId = isSubscriptionEvent ? subscription?.id : payment?.subscription
  const customerId = isSubscriptionEvent ? subscription?.customer : payment?.customer

  let empresaId: string | null = null
  let empresaPlano: string | null = null
  let empresaStatusAtual: string | null = null

  // Se ESTA subscription específica já tem linha em `assinaturas`, ela já foi
  // registrada por alguém (o insert síncrono de assinarPlano(), ou uma entrega
  // anterior deste mesmo processamento) — usado abaixo pra não reprocessar o
  // bloco de SUBSCRIPTION_CREATED em cima de uma subscription já conhecida.
  let assinaturaJaRegistrada = false
  if (subscriptionId) {
    const { data: assinatura, error: assinaturaErr } = await supabase
      .from('assinaturas')
      .select('empresa_id')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle()
    if (assinaturaErr) {
      console.error('[webhook] Erro ao buscar assinatura:', assinaturaErr.message)
    }
    empresaId = assinatura?.empresa_id ?? null
    assinaturaJaRegistrada = !!assinatura
  }

  // Fallback do fluxo trial-com-cartão: em SUBSCRIPTION_CREATED ainda não
  // existe nenhuma linha em `assinaturas` pra essa subscription (é este
  // evento que vai criar a primeira) — o lookup acima sempre dá null. Resolver
  // por externalReference (= empresaId, setado na criação do Checkout — ver
  // createCheckout/iniciarCheckoutCartao) é mais direto e não depende do Asaas
  // ter deduplicado o cliente do checkout com o customer pré-criado. Se não
  // resolver nada, cai no fallback por customer de sempre (abaixo).
  if (!empresaId && isSubscriptionEvent && subscription?.externalReference) {
    const { data: empresaPorRef, error: refErr } = await supabase
      .from('empresas')
      .select('id, plano, status')
      .eq('id', subscription.externalReference)
      .maybeSingle()
    if (refErr) {
      console.error('[webhook] Erro ao buscar empresa por externalReference:', refErr.message)
    }
    if (empresaPorRef) {
      empresaId = empresaPorRef.id
      empresaPlano = empresaPorRef.plano
      empresaStatusAtual = empresaPorRef.status
    }
  }

  if (!empresaId) {
    const { data: empresa, error: empresaErr } = await supabase
      .from('empresas')
      .select('id, plano, status')
      .eq('asaas_customer_id', customerId ?? '')
      .maybeSingle()
    if (empresaErr) {
      console.error('[webhook] Erro ao buscar empresa por customer:', empresaErr.message)
    }
    empresaId = empresa?.id ?? null
    empresaPlano = empresa?.plano ?? null
    empresaStatusAtual = empresa?.status ?? null
  } else if (empresaPlano === null) {
    const { data: empresa, error: empresaErr } = await supabase
      .from('empresas')
      .select('plano, status')
      .eq('id', empresaId)
      .maybeSingle()
    if (empresaErr) {
      console.error('[webhook] Erro ao buscar empresa por id:', empresaErr.message)
    }
    empresaPlano = empresa?.plano ?? null
    empresaStatusAtual = empresa?.status ?? null
  }

  if (!empresaId) {
    await supabase
      .from('eventos_webhook')
      .update({ error: `empresa_id não encontrada para customer=${customerId ?? '(sem customer)'}`, processed: true, processed_at: new Date().toISOString() })
      .eq('asaas_event_id', asaasEventId)

    // SUBSCRIPTION_CREATED sem empresa resolvida (nem por externalReference,
    // nem por customer) é grave: alguém pode ter confirmado cartão/pagamento
    // real e a conta ficar travada em 'pendente_cartao' pra sempre, sem
    // ninguém saber — a menos que alguém consulte eventos_webhook.error
    // manualmente. Alerta o dono da plataforma pra investigar na hora.
    if (event === 'SUBSCRIPTION_CREATED') {
      sendAlertaInterno({
        to:        ALERTA_EMAIL,
        assunto:   '[CRM Studio] Webhook Asaas: empresa não resolvida em SUBSCRIPTION_CREATED',
        titulo:    'Assinatura confirmada sem empresa correspondente',
        descricao: 'Um evento SUBSCRIPTION_CREATED do Asaas chegou mas não foi possível resolver a empresa (nem por externalReference, nem por asaas_customer_id). Isso pode significar um cliente que confirmou o cartão mas ficou travado sem acesso — verifique manualmente no painel do Asaas e em eventos_webhook.error.',
        linhas:    [`subscription_id: ${subscriptionId ?? '(nenhum)'}`, `customer_id: ${customerId ?? '(nenhum)'}`, `evento: ${asaasEventId}`],
        destaque:  'perigo',
      }).catch((e: unknown) => {
        console.error('[webhook] falha ao enviar alerta interno:', e)
      })
    }

    return NextResponse.json({ ok: true })
  }

  // Guard: nunca alterar status de empresas internas (sandbox / contas da plataforma)
  if (empresaPlano === 'interno') {
    await supabase
      .from('eventos_webhook')
      .update({ empresa_id: empresaId, processed: true, processed_at: new Date().toISOString() })
      .eq('asaas_event_id', asaasEventId)
    return NextResponse.json({ ok: true, skipped: 'interno' })
  }

  // Atualizar empresa_id no evento agora que resolvemos
  await supabase
    .from('eventos_webhook')
    .update({ empresa_id: empresaId })
    .eq('asaas_event_id', asaasEventId)

  // 5. UPSERT em faturas (somente eventos PAYMENT_*, que carregam payment)
  const faturaStatus = faturasStatusFromEvent(event)
  if (faturaStatus && payment?.id) {
    await supabase
      .from('faturas')
      .upsert({
        empresa_id:       empresaId,
        asaas_payment_id: payment.id,
        status:           faturaStatus,
        valor:            payment.value ?? 0,
        vencimento:       payment.dueDate ?? null,
        pago_em:          payment.paymentDate ?? null,
        billing_type:     payment.billingType ?? null,
        invoice_url:      payment.invoiceUrl ?? null,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'asaas_payment_id' })
  }

  // 5b. SUBSCRIPTION_CREATED — ativa o trial do fluxo "cartão obrigatório no
  //     cadastro" (spec: .claude/specs/trial-com-cartao.md).
  //
  //     CRÍTICO (revisão adversarial 2026-07-08): o INSERT abaixo NÃO é mais
  //     condicionado a empresaStatusAtual === 'pendente_cartao' — só a
  //     LIBERAÇÃO DO TRIAL (o UPDATE em empresas, no fim) é. Motivo: se o
  //     insert só fosse tentado quando a empresa ainda está pendente_cartao,
  //     uma 2ª subscription real confirmada DEPOIS que uma 1ª já liberou o
  //     trial (ex.: usuário conclui dois checkouts do trial-com-cartão, ou
  //     volta numa aba/e-mail antigo dias depois) caía num no-op silencioso —
  //     nenhum insert, nenhum cancelSubscription — deixando uma assinatura
  //     recorrente ATIVA no Asaas cobrando o cartão pra sempre, sem nenhum
  //     registro em `assinaturas` e invisível no admin. Agora o insert é
  //     SEMPRE tentado (guardado por assinaturaJaRegistrada pra não reprocessar
  //     uma subscription que já tem linha — caso do fluxo normal de
  //     assinarPlano(), que insere a sua própria linha sincronamente ANTES do
  //     webhook chegar, então cai aqui com assinaturaJaRegistrada=true e este
  //     bloco inteiro vira no-op pra ela, como sempre foi). Uma 2ª subscription
  //     do trial-com-cartão colide no UNIQUE (empresa_id) WHERE status <>
  //     'cancelado' existente (23505) e é cancelada como órfã — em vez de
  //     nunca ser detectada.
  if (event === 'SUBSCRIPTION_CREATED' && subscriptionId && !assinaturaJaRegistrada) {
    const { error: insertAssinaturaErr } = await supabase.from('assinaturas').insert({
      empresa_id:            empresaId,
      plano:                 'starter',
      asaas_subscription_id: subscriptionId,
      status:                'trial',
      billing_type:          'CREDIT_CARD',
      cycle:                 'MONTHLY',
      value:                 147,
    })

    if (insertAssinaturaErr && insertAssinaturaErr.code === '23505') {
      // CRÍTICO (revisão adversarial 2026-07-08, 2ª rodada): antes de cancelar,
      // confirma que a subscription conflitante é REALMENTE outra diferente
      // desta — não a mesma subscription que outro escritor concorrente (ex.:
      // assinarPlano(), que insere sua própria linha SINCRONAMENTE, correndo
      // em paralelo ao processamento deste mesmo webhook) já registrou
      // legitimamente. Sem essa checagem, uma corrida rara faria este código
      // cancelar no Asaas a assinatura REAL de um cliente pagante que acabou
      // de assinar um plano pago, achando (errado) que era uma órfã.
      // ponytail: o INSERT (acima) e este SELECT não são atômicos — se a linha
      // conflitante for cancelada por um evento concorrente bem nessa janela
      // estreita, o SELECT pode vir vazio e uma subscription genuinamente órfã
      // deixa de ser cancelada aqui (favorecemos NÃO cancelar na dúvida, pra
      // nunca arriscar cancelar uma assinatura legítima — vazamento de receita
      // é um mal menor que cancelar cliente pagante por engano). Upgrade se
      // isso incomodar na prática: mover pra uma função no Postgres com
      // INSERT ... ON CONFLICT (empresa_id) WHERE status <> 'cancelado' DO
      // NOTHING RETURNING *, atômico de verdade.
      const { data: conflitante } = await supabase
        .from('assinaturas')
        .select('asaas_subscription_id')
        .eq('empresa_id', empresaId)
        .neq('status', 'cancelado')
        .maybeSingle()

      if (conflitante && conflitante.asaas_subscription_id !== subscriptionId) {
        // Subscription genuinamente diferente/stale — cancela como órfã.
        cancelSubscription(subscriptionId).catch((e: unknown) => {
          console.error('[webhook] falha ao cancelar subscription órfã no Asaas:', e)
        })
      }
      // Se for a mesma subscriptionId (ou a busca não achar nada por causa de
      // outra corrida), não faz nada — outro escritor já registrou esta
      // exata subscription; cancelar destruiria uma assinatura legítima.
    } else if (insertAssinaturaErr) {
      console.error('[webhook] Erro ao inserir assinatura (SUBSCRIPTION_CREATED):', insertAssinaturaErr.message)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    } else if (empresaStatusAtual === 'pendente_cartao') {
      // Só libera o trial se o insert aconteceu de fato (não em cima do
      // 23505) E a empresa realmente estava esperando o cartão. Condicional
      // em status='pendente_cartao' trava contra qualquer corrida que já
      // tenha mudado o status entretanto.
      const { error: updateEmpresaErr } = await supabase
        .from('empresas')
        .update({
          status:        'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', empresaId)
        .eq('status', 'pendente_cartao')

      // E-mail de acesso (spec onboarding-senha-pos-pagamento.md, Parte B) —
      // só dispara quando o UPDATE acima teve sucesso, ou seja, só na
      // transição real pendente→trial. Fire-and-forget: erro de e-mail nunca
      // derruba o processamento do evento (mesmo padrão do sendAlertaInterno
      // acima neste arquivo) — se falhar, a sessão original (Parte D) ainda
      // permite a pessoa continuar.
      if (!updateEmpresaErr) {
        enviarEmailAcessoLiberado(supabase, empresaId).catch((e: unknown) => {
          console.error('[webhook] falha ao enviar e-mail de acesso liberado:', e)
        })
      }
    }
  }

  // 6. Transição de estado da assinatura
  let novoStatus: string | null = null

  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    novoStatus = 'ativo'
  } else if (event === 'PAYMENT_OVERDUE') {
    // Só rebaixar para 'atrasado' se o status atual for reversível.
    // Se a empresa já está 'cancelado' (ou outro estado terminal), um
    // PAYMENT_OVERDUE retroativo NÃO deve reverter o acesso.
    const STATUS_PERMITEM_ATRASADO = new Set(['ativo', 'trial'])
    const { data: empresaAtual, error: statusErr } = await supabase
      .from('empresas')
      .select('status')
      .eq('id', empresaId)
      .maybeSingle()
    if (statusErr) {
      // Não conseguimos determinar o status atual → não decidir às cegas.
      // Retorna 500 para o Asaas reenviar (sem marcar o evento como processado).
      console.error('[webhook] Erro ao buscar status atual da empresa (code=%s)', statusErr.code)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
    const statusAtual = empresaAtual?.status ?? null
    if (statusAtual && STATUS_PERMITEM_ATRASADO.has(statusAtual)) {
      novoStatus = 'atrasado'
    }
    // Se statusAtual for 'cancelado' ou qualquer estado terminal, novoStatus
    // permanece null e nenhuma atualização de status é feita.
  } else if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_CANCELLED' || event === 'SUBSCRIPTION_INACTIVATED') {
    novoStatus = 'cancelado'
  }

  if (novoStatus) {
    const updateAssinatura: Record<string, unknown> = {
      status:     novoStatus,
      updated_at: new Date().toISOString(),
    }
    if (novoStatus === 'ativo') {
      updateAssinatura.dunning_since = null
    } else if (novoStatus === 'atrasado') {
      updateAssinatura.dunning_since = new Date().toISOString()
    }

    if (subscriptionId) {
      await supabase
        .from('assinaturas')
        .update(updateAssinatura)
        .eq('asaas_subscription_id', subscriptionId)
    }

    // Cache de status na empresa (lido pelo gate de acesso)
    await supabase
      .from('empresas')
      .update({ status: novoStatus })
      .eq('id', empresaId)
  }

  // 7. Marcar evento como processado
  await supabase
    .from('eventos_webhook')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('asaas_event_id', asaasEventId)

  return NextResponse.json({ ok: true })
}
