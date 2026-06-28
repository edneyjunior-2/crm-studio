import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual, createHash } from 'crypto'

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
  id:        string          // sub_...
  customer:  string          // cus_...
  status?:   string
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
    // Erro inesperado ao gravar — retornar 200 mesmo assim para não travar fila
    console.error('[webhook] Erro ao inserir evento:', insertErr.message)
    return NextResponse.json({ ok: true })
  }

  // 4. Resolver empresa_id
  // Em eventos SUBSCRIPTION_*, a chave é subscription.id; nos PAYMENT_*,
  // payment.subscription. O fallback por customer usa o customer do payload
  // correspondente.
  const subscriptionId = isSubscriptionEvent ? subscription?.id : payment?.subscription
  const customerId = isSubscriptionEvent ? subscription?.customer : payment?.customer

  let empresaId: string | null = null
  let empresaPlano: string | null = null

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
  }

  if (!empresaId) {
    const { data: empresa, error: empresaErr } = await supabase
      .from('empresas')
      .select('id, plano')
      .eq('asaas_customer_id', customerId ?? '')
      .maybeSingle()
    if (empresaErr) {
      console.error('[webhook] Erro ao buscar empresa por customer:', empresaErr.message)
    }
    empresaId = empresa?.id ?? null
    empresaPlano = empresa?.plano ?? null
  } else {
    const { data: empresa, error: empresaErr } = await supabase
      .from('empresas')
      .select('plano')
      .eq('id', empresaId)
      .maybeSingle()
    if (empresaErr) {
      console.error('[webhook] Erro ao buscar empresa por id:', empresaErr.message)
    }
    empresaPlano = empresa?.plano ?? null
  }

  if (!empresaId) {
    await supabase
      .from('eventos_webhook')
      .update({ error: `empresa_id não encontrada para customer=${customerId ?? '(sem customer)'}`, processed: true, processed_at: new Date().toISOString() })
      .eq('asaas_event_id', asaasEventId)
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

  // 6. Transição de estado da assinatura
  let novoStatus: string | null = null

  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    novoStatus = 'ativo'
  } else if (event === 'PAYMENT_OVERDUE') {
    novoStatus = 'atrasado'
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
