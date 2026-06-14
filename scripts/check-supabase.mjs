// Teste de conexão com o Supabase. Roda com:
//   node --env-file=.env.local scripts/check-supabase.mjs
// Lê as chaves do ambiente; nunca imprime segredos.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY

function mask(k) {
  return k ? `${k.slice(0, 6)}…${k.slice(-4)} (${k.length} chars)` : 'AUSENTE'
}

console.log('URL:', url || 'AUSENTE')
console.log('anon:', mask(anon))
console.log('service_role:', mask(svc))

if (!url || !anon) {
  console.log('\n❌ Faltam variáveis. Verifique o .env.local.')
  process.exit(1)
}

const sb = createClient(url, anon, { auth: { persistSession: false } })

// 1) Conexão básica via Auth (não depende de tabelas)
const { error: authErr } = await sb.auth.getSession()
console.log('\nAuth/conexão:', authErr ? `erro: ${authErr.message}` : 'OK (endpoint respondeu)')

// 2) Estado do schema: existe a tabela profiles?
const { error: tblErr } = await sb.from('profiles').select('id').limit(1)
if (!tblErr) {
  console.log('Schema: tabela "profiles" EXISTE (migrations já aplicadas).')
} else if (/relation .*does not exist|Could not find the table|schema cache/i.test(tblErr.message)) {
  console.log('Schema: banco VAZIO (tabelas ainda não criadas) — esperado antes do M0.')
} else {
  console.log('Schema: resposta inesperada ->', tblErr.message)
}
