/**
 * Cadastra um usuário como platform_admin do CRM Studio.
 * Uso: node --env-file=.env.local scripts/seed-platform-admin.mjs <email>
 */
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
if (!email) { console.error('Uso: node scripts/seed-platform-admin.mjs <email>'); process.exit(1) }

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Busca o UUID pelo email
const { data: { users }, error: listErr } = await db.auth.admin.listUsers()
if (listErr) { console.error('Erro ao listar usuários:', listErr.message); process.exit(1) }

const user = users.find(u => u.email === email)
if (!user) { console.error(`Usuário não encontrado: ${email}`); process.exit(1) }

console.log(`Usuário encontrado: ${user.id}`)

// Insere em platform_admins
const { error } = await db.from('platform_admins').upsert({ user_id: user.id })
if (error) { console.error('Erro ao inserir em platform_admins:', error.message); process.exit(1) }

console.log(`✅ ${email} agora é platform_admin.`)
