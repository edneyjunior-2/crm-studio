// Teste de isolamento entre tenants (M0). Roda com:
//   node --env-file=.env.local scripts/test-isolation.mjs
// Cria 2 empresas via signup real (service_role → dispara handle_new_user),
// insere dados logado como cada usuário (RLS aplicada via JWT), e prova que
// um tenant NÃO vê o outro + que o anti-spoofing de empresa_id funciona.
// Limpa tudo no final.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } })

const PW = 'Teste-Isolamento-9x7!'
const A = { email: 'tenant-a@isolation-test.local', empresa: 'Empresa A (teste)' }
const B = { email: 'tenant-b@isolation-test.local', empresa: 'Empresa B (teste)' }

let failures = 0
const ok = (m) => console.log('  ✅', m)
const bad = (m) => { console.log('  ❌', m); failures++ }

async function criarTenant(t) {
  // remove resíduo de runs anteriores
  const { data: list } = await admin.auth.admin.listUsers()
  const ja = list?.users?.find((u) => u.email === t.email)
  if (ja) await admin.auth.admin.deleteUser(ja.id)

  const { data, error } = await admin.auth.admin.createUser({
    email: t.email,
    password: PW,
    email_confirm: true,
    user_metadata: { empresa_nome: t.empresa, full_name: `Admin ${t.empresa}` },
  })
  if (error) throw new Error(`createUser ${t.email}: ${error.message}`)
  const userId = data.user.id
  // handle_new_user (trigger) já criou empresa + profile
  const { data: prof, error: pe } = await admin.from('profiles').select('empresa_id, role').eq('id', userId).single()
  if (pe) throw new Error(`profile ${t.email}: ${pe.message}`)
  return { userId, empresaId: prof.empresa_id, role: prof.role }
}

async function sessao(email) {
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`login ${email}: ${error.message}`)
  return c
}

async function main() {
  console.log('=== Setup: criando 2 tenants via signup real ===')
  const ta = await criarTenant(A)
  const tb = await criarTenant(B)
  console.log(`  Empresa A=${ta.empresaId?.slice(0, 8)} (role ${ta.role}) · Empresa B=${tb.empresaId?.slice(0, 8)} (role ${tb.role})`)
  if (!ta.empresaId || !tb.empresaId) bad('handle_new_user não setou empresa_id'); else ok('handle_new_user criou empresa + admin para cada um')
  if (ta.empresaId === tb.empresaId) bad('as duas empresas têm o MESMO id (erro grave)')

  const ca = await sessao(A.email)
  const cb = await sessao(B.email)

  console.log('\n=== Inserts (cada um logado como si) ===')
  const insA = await ca.from('clientes').insert({ razao_social: 'Cliente da A', created_by: ta.userId }).select('id, razao_social, empresa_id').single()
  if (insA.error) bad(`A não conseguiu inserir cliente: ${insA.error.message}`)
  else { ok(`A inseriu "Cliente da A" (empresa_id ${insA.data.empresa_id?.slice(0,8)})`); if (insA.data.empresa_id !== ta.empresaId) bad('cliente de A não recebeu empresa_id de A') }
  const insB = await cb.from('clientes').insert({ razao_social: 'Cliente da B', created_by: tb.userId }).select('id, razao_social, empresa_id').single()
  if (insB.error) bad(`B não conseguiu inserir cliente: ${insB.error.message}`)
  else ok(`B inseriu "Cliente da B" (empresa_id ${insB.data.empresa_id?.slice(0,8)})`)

  console.log('\n=== ISOLAMENTO: A lista clientes ===')
  const { data: vistosPorA, error: eList } = await ca.from('clientes').select('razao_social, empresa_id')
  if (eList) bad(`A falhou ao listar: ${eList.message}`)
  else {
    const nomes = vistosPorA.map((c) => c.razao_social)
    console.log('  A vê:', JSON.stringify(nomes))
    if (nomes.includes('Cliente da B')) bad('VAZAMENTO: A enxergou "Cliente da B"')
    else ok('A NÃO vê dados de B')
    if (!nomes.includes('Cliente da A')) bad('A não vê o próprio cliente (RLS bloqueou demais)')
    else ok('A vê o próprio cliente')
  }

  console.log('\n=== ISOLAMENTO: acesso direto ao cliente de B por id ===')
  if (insB.data) {
    const { data: alvo } = await ca.from('clientes').select('id').eq('id', insB.data.id).maybeSingle()
    if (alvo) bad('VAZAMENTO: A acessou o cliente de B por id direto')
    else ok('A não acessa o cliente de B nem por id direto')
  }

  console.log('\n=== ANTI-SPOOFING: A tenta gravar na empresa de B ===')
  const spoof = await ca.from('clientes').insert({ razao_social: 'Spoof tentativa', empresa_id: tb.empresaId, created_by: ta.userId }).select('empresa_id').single()
  if (spoof.error) ok(`spoof rejeitado pelo banco (${spoof.error.message.slice(0,60)})`)
  else if (spoof.data.empresa_id === ta.empresaId) ok('spoof neutralizado: registro nasceu na empresa de A, não de B')
  else bad(`VAZAMENTO: spoof gravou na empresa ${spoof.data.empresa_id?.slice(0,8)} (esperado A=${ta.empresaId?.slice(0,8)})`)

  console.log('\n=== Cleanup ===')
  await admin.from('clientes').delete().in('created_by', [ta.userId, tb.userId])
  await admin.from('empresas').delete().in('id', [ta.empresaId, tb.empresaId])
  await admin.auth.admin.deleteUser(ta.userId)
  await admin.auth.admin.deleteUser(tb.userId)
  ok('tenants de teste removidos')

  console.log(`\n${failures === 0 ? '✅ ISOLAMENTO APROVADO — nenhum vazamento' : `❌ ${failures} FALHA(S) — NÃO liberar`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error('ERRO no teste:', e.message); process.exit(1) })
