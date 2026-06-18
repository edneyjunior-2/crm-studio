import 'server-only'

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

const PLANO_VALOR: Record<string, number> = {
  free:     0,
  trial:    0,
  interno:  0,
  starter:  149,
  pro:      449,
  business: 990,
}

/**
 * Cria uma assinatura recorrente mensal no Asaas.
 * Plano 'free' não deve gerar subscription (valor zero) — cabe ao caller verificar.
 */
export async function createSubscription(
  asaasCustomerId: string,
  plano: string,
  nextDueDate: string,                    // ISO date string: '2026-07-17'
  billingType: string = 'UNDEFINED',
): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('POST', '/subscriptions', {
    customer:    asaasCustomerId,
    billingType,
    value:       PLANO_VALOR[plano] ?? 0,
    nextDueDate,
    cycle:       'MONTHLY',
    description: `Assinatura CRM Studio — Plano ${plano.charAt(0).toUpperCase() + plano.slice(1)}`,
  })
}

/**
 * Busca os detalhes de uma cobrança específica (reconciliação).
 */
export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>('GET', `/payments/${paymentId}`)
}
