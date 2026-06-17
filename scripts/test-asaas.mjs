/**
 * Testa conexão com a API Asaas (sandbox).
 * Uso: node --env-file=.env.local scripts/test-asaas.mjs
 */

const BASE_URL = process.env.ASAAS_BASE_URL
const API_KEY  = process.env.ASAAS_API_KEY

if (!BASE_URL || !API_KEY) {
  console.error('❌ ASAAS_BASE_URL ou ASAAS_API_KEY não definidos no .env.local')
  process.exit(1)
}

console.log('🔌 Testando conexão Asaas...')
console.log(`   URL: ${BASE_URL}`)
console.log(`   Key: ${API_KEY.slice(0, 20)}...`)

async function req(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'access_token': API_KEY,
      'User-Agent': 'crm-studio',
      'Content-Type': 'application/json',
    },
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

// 1. Listar clientes (valida auth)
console.log('\n1️⃣  GET /customers?limit=1')
const customers = await req('/customers?limit=1')
if (customers.status === 200) {
  console.log(`   ✅ Auth OK — ${customers.body.totalCount ?? 0} clientes na conta`)
} else if (customers.status === 401) {
  console.error('   ❌ Chave inválida ou ambiente errado (sandbox vs produção)')
  console.error('   Resposta:', JSON.stringify(customers.body))
  process.exit(1)
} else {
  console.error(`   ❌ Status inesperado: ${customers.status}`)
  console.error('   Resposta:', JSON.stringify(customers.body))
  process.exit(1)
}

// 2. Listar planos de assinatura (valida acesso ao endpoint)
console.log('\n2️⃣  GET /subscriptions?limit=1')
const subs = await req('/subscriptions?limit=1')
if (subs.status === 200) {
  console.log(`   ✅ Subscriptions OK — ${subs.body.totalCount ?? 0} assinaturas`)
} else {
  console.warn(`   ⚠️  Status ${subs.status}:`, JSON.stringify(subs.body))
}

// 3. Criar um cliente de teste e deletar em seguida
console.log('\n3️⃣  Criar + deletar cliente de teste')
const createRes = await fetch(`${BASE_URL}/customers`, {
  method: 'POST',
  headers: {
    'access_token': API_KEY,
    'User-Agent': 'crm-studio',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Empresa Teste CRM Studio',
    cpfCnpj: '11222333000181',
    email: 'teste@crm-studio.dev',
    externalReference: 'test-connection-script',
    notificationDisabled: true,
  }),
})
const created = await createRes.json().catch(() => ({}))
if (createRes.status === 200 || createRes.status === 201) {
  console.log(`   ✅ Cliente criado: ${created.id}`)
  // Deletar
  const delRes = await fetch(`${BASE_URL}/customers/${created.id}`, {
    method: 'DELETE',
    headers: { 'access_token': API_KEY, 'User-Agent': 'crm-studio' },
  })
  const del = await delRes.json().catch(() => ({}))
  if (del.deleted) {
    console.log(`   ✅ Cliente deletado: ${created.id}`)
  } else {
    console.warn(`   ⚠️  Não deletou:`, JSON.stringify(del))
  }
} else {
  console.warn(`   ⚠️  Criar cliente — status ${createRes.status}:`, JSON.stringify(created))
}

console.log('\n✅ Teste concluído — API Asaas funcionando no sandbox.')
