// Semeia a 1ª conta admin (fundador) no banco. Roda com:
//   node --env-file=.env.local scripts/seed-admin.mjs [email] [empresa]
// Cria o usuário (email já confirmado) -> handle_new_user cria a empresa e o
// profile admin. Idempotente: se o e-mail já existe, redefine a senha temporária.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } })

const email = process.argv[2] || 'edneyjuniords@gmail.com'
const empresa = process.argv[3] || 'CRM Studio'
const tempPw = 'CrmStudio#Trocar1'

const { data: list } = await admin.auth.admin.listUsers()
const existing = list?.users?.find((u) => u.email === email)

let userId
if (existing) {
  userId = existing.id
  await admin.auth.admin.updateUserById(userId, { password: tempPw, email_confirm: true })
  console.log('Usuário já existia — senha temporária redefinida.')
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPw,
    email_confirm: true,
    user_metadata: { empresa_nome: empresa, full_name: 'Edney' },
  })
  if (error) { console.error('Erro ao criar usuário:', error.message); process.exit(1) }
  userId = data.user.id
  console.log('Usuário criado.')
}

// confirma profile + empresa
const { data: prof, error: pe } = await admin
  .from('profiles')
  .select('full_name, role, empresa_id, empresas(nome, plano, status, trial_ends_at)')
  .eq('id', userId)
  .single()

if (pe) { console.error('Não consegui ler o profile:', pe.message); process.exit(1) }

console.log('\n=== Conta pronta ===')
console.log('  empresa :', prof.empresas?.nome, `(plano ${prof.empresas?.plano} · status ${prof.empresas?.status})`)
console.log('  role    :', prof.role)
console.log('  trial até:', prof.empresas?.trial_ends_at)
console.log('\n=== LOGIN (http://localhost:3000/login) ===')
console.log('  e-mail :', email)
console.log('  senha  :', tempPw, '  ← troque depois em /minha-conta')
