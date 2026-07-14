import 'server-only'
import { PLANOS_VENDAVEIS, PRECO_POR_PLANO, PLANO_LABEL, type PlanoVendavel } from '@/lib/planos'

const USER_AGENT = 'crm-studio'

// Validação lazy — só falha quando chamado, nunca em build/import
function getConfig() {
  const BASE_URL = process.env.ASAAS_BASE_URL
  const API_KEY  = process.env.ASAAS_API_KEY
  if (!BASE_URL || !API_KEY) {
    throw new Error('ASAAS_BASE_URL e ASAAS_API_KEY são obrigatórios.')
  }
  return { BASE_URL, API_KEY }
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function asaasRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const { BASE_URL, API_KEY } = getConfig()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'access_token':   API_KEY,
      'User-Agent':     USER_AGENT,
      'Content-Type':   'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(
      `Asaas ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`,
    )
  }

  return data as T
}

// ---------------------------------------------------------------------------
// Tipos mínimos
// ---------------------------------------------------------------------------

export interface AsaasCustomer {
  id: string
  name: string
  email?: string
  cpfCnpj?: string
  externalReference?: string
}

export interface AsaasSubscription {
  id: string
  customer: string
  status: string
  value: number
  nextDueDate: string
  billingType: string
  cycle: string
}

export interface AsaasPayment {
  id: string
  customer: string
  subscription?: string
  status: string
  value: number
  dueDate: string
  paymentDate?: string
  billingType: string
  invoiceUrl?: string
}

// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------

/**
 * Cria um cliente no Asaas vinculado a uma empresa do CRM Studio.
 * Grava empresaId em externalReference para reconciliação.
 * cnpj é opcional — omitido se vazio.
 */
export async function createCustomer(
  empresaId: string,
  nome: string,
  email: string,
  cnpj?: string,
): Promise<AsaasCustomer> {
  const digits = cnpj?.replace(/\D/g, '') ?? ''
  return asaasRequest<AsaasCustomer>('POST', '/customers', {
    name:               nome,
    ...(digits ? { cpfCnpj: digits } : {}),
    email,
    externalReference:  empresaId,
    notificationDisabled: false,
  })
}

/**
 * Cria uma assinatura recorrente mensal no Asaas.
 *
 * Valor e rótulo vêm SEMPRE de src/lib/planos.ts (PRECO_POR_PLANO/PLANO_LABEL)
 * — fonte única de preço do projeto (spec planos-verticais-no-checkout.md).
 * Plano fora da whitelist de vendáveis lança erro: nunca cobrar 0 silenciosamente.
 */
export async function createSubscription(
  asaasCustomerId: string,
  plano: string,
  nextDueDate: string,                    // ISO date string: '2026-07-17'
  billingType: string = 'UNDEFINED',
): Promise<AsaasSubscription> {
  if (!(PLANOS_VENDAVEIS as readonly string[]).includes(plano)) {
    throw new Error(`Plano desconhecido: ${plano}`)
  }
  const planoVendavel = plano as PlanoVendavel

  return asaasRequest<AsaasSubscription>('POST', '/subscriptions', {
    customer:    asaasCustomerId,
    billingType,
    value:       PRECO_POR_PLANO[planoVendavel],
    nextDueDate,
    cycle:       'MONTHLY',
    description: `Assinatura CRM Studio — Plano ${PLANO_LABEL[planoVendavel]}`,
  })
}

/**
 * Busca os detalhes de uma cobrança específica (reconciliação).
 */
export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('GET', `/payments/${paymentId}`)
}

/**
 * Busca os dados de um cliente específico — nome/CPF-CNPJ/e-mail reais que a
 * pessoa informou na tela do Checkout hospedado. O payload do webhook não
 * traz esses dados de volta (só o id do customer), por isso o backfill em
 * SUBSCRIPTION_CREATED busca aqui (ver src/app/api/asaas/webhook/route.ts).
 */
export async function getCustomer(customerId: string): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('GET', `/customers/${customerId}`)
}

export interface AsaasDeletedSubscription {
  id: string
  deleted: boolean
}

/**
 * Cancela (remove) uma assinatura recorrente no Asaas.
 * Asaas: DELETE /v3/subscriptions/{id}. Interrompe cobranças futuras.
 */
export async function cancelSubscription(
  asaasSubscriptionId: string,
): Promise<AsaasDeletedSubscription> {
  return asaasRequest<AsaasDeletedSubscription>(
    'DELETE',
    `/subscriptions/${asaasSubscriptionId}`,
  )
}

// ---------------------------------------------------------------------------
// Checkout hospedado (trial com cartão obrigatório)
// ---------------------------------------------------------------------------

export interface AsaasCheckout {
  id: string
  link: string
  status: string
}

// 1x1 pixel transparente — o schema do Asaas (CheckoutSessionItemsDTO) marca
// `imageBase64` como campo obrigatório do item, mesmo para venda sem produto
// físico (assinatura de SaaS). Não há imagem real a mostrar; usamos um
// placeholder mínimo só para satisfazer a validação da API.
const PIXEL_TRANSPARENTE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

/**
 * Cria um Checkout hospedado do Asaas (POST /v3/checkouts) para uma assinatura
 * recorrente mensal cobrada em cartão de crédito. O cartão é validado no ato
 * pelo Asaas; a primeira cobrança real só acontece em `nextDueDate`.
 *
 * Nota de schema (verificado na doc oficial em 2026-07):
 *  - NÃO existe campo `customer` (id de cliente já existente) no body deste
 *    endpoint — só `customerData` (dados soltos).
 *  - `customer` é opcional aqui: quando omitido, `customerData` não é enviado
 *    e a própria Asaas deixa a pessoa preencher nome/CPF-CNPJ/e-mail na
 *    página hospedada do Checkout (doc oficial:
 *    https://docs.asaas.com/docs/how-to-provide-customer-data). Os dados
 *    reais informados são recuperados depois via `getCustomer()` no webhook
 *    (SUBSCRIPTION_CREATED) e gravados em `empresas` — ver
 *    src/app/api/asaas/webhook/route.ts.
 *  - O valor da cobrança vem de `items[].value` (não existe `subscription.value`
 *    no schema real) — `subscription` só carrega `cycle`/`nextDueDate`/`endDate`.
 */
export async function createCheckout(params: {
  empresaId: string
  customer?: { name: string; email?: string; cpfCnpj?: string }
  value: number
  plano: PlanoVendavel
  nextDueDate: string    // 'YYYY-MM-DD'
  successUrl: string
  cancelUrl: string
  expiredUrl: string
}): Promise<AsaasCheckout> {
  const { empresaId, customer, value, plano, nextDueDate, successUrl, cancelUrl, expiredUrl } = params
  const digits = customer?.cpfCnpj?.replace(/\D/g, '') ?? ''

  return asaasRequest<AsaasCheckout>('POST', '/checkouts', {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes:  ['RECURRENT'],
    callback: {
      successUrl,
      cancelUrl,
      expiredUrl,
    },
    items: [{
      name:        'Assinatura CRM Studio',
      description: `Plano ${PLANO_LABEL[plano]} — cobrança mensal recorrente`,
      value,
      quantity:    1,
      imageBase64: PIXEL_TRANSPARENTE_BASE64,
    }],
    ...(customer ? {
      customerData: {
        name:  customer.name,
        ...(customer.email ? { email: customer.email } : {}),
        ...(digits ? { cpfCnpj: digits } : {}),
      },
    } : {}),
    subscription: {
      cycle: 'MONTHLY',
      nextDueDate,
    },
    externalReference: empresaId,
  })
}
