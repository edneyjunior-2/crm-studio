# E2E Tests — CRM Studio

Testes end-to-end com [Playwright](https://playwright.dev/).

## Setup rápido

### 1. Criar usuário de teste no Supabase

No SQL Editor do Supabase (usando service role):

```sql
-- Verificar a empresa de teste existente
SELECT id, nome, plano, status FROM empresas WHERE nome = 'Edney Junio';

-- Anotar o ID retornado — será o TEST_EMPRESA_ID
```

Crie o usuário via Supabase Dashboard → Authentication → Users → Add user:
- Email: `e2e@teste.crm`
- Password: escolha uma senha forte

Depois vincule o usuário à empresa:

```sql
-- Substituir <USER_ID> pelo UUID gerado pelo Supabase Auth
UPDATE profiles
SET empresa_id = '5be8ae72-a2dd-4e6e-9d51-7e47b7c41e3f',
    role = 'admin'
WHERE id = '<USER_ID>';
```

### 2. Criar `.env.test.local`

```env
# Credenciais do usuário de teste (NUNCA commitar)
TEST_USER_EMAIL=e2e@teste.crm
TEST_USER_PASSWORD=suaSenhaForte

# ID da empresa do usuário de teste (para o teste de paywall)
TEST_EMPRESA_ID=5be8ae72-a2dd-4e6e-9d51-7e47b7c41e3f

# Já definidas no .env.local — copie aqui também se necessário
NEXT_PUBLIC_SUPABASE_URL=https://pmzuzzwaawidypxqymqy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Rodar os testes

```bash
# Com dev server automático
npm run test:e2e

# Interface visual
npm run test:e2e:ui

# Modo debug (passo a passo)
npx playwright test --debug

# Só um arquivo
npx playwright test e2e/auth.spec.ts
```

## Estrutura

```
e2e/
  fixtures.ts         — helper loginAs(), setEmpresaStatus(), variáveis de ambiente
  auth.spec.ts        — login, logout, rota protegida sem login
  cadastro.spec.ts    — signup PJ completo, validações
  clientes.spec.ts    — criar/cancelar cliente via dialog
  paywall.spec.ts     — redirect para /assinatura quando empresa suspenso/cancelado
```

## Notas

- **Workers = 1**: os testes rodam em sequência para evitar conflitos no Supabase compartilhado.
- **Paywall tests**: o `TEST_EMPRESA_ID` deve ser a empresa do usuário de teste. O teste muda temporariamente o status para `suspenso` e restaura em `finally` — mesmo se o teste falhar.
- **Empresa 'interno'**: se o usuário de teste for `plano='interno'`, o teste de paywall será ignorado automaticamente pelo guard do webhook — para testá-lo, use uma empresa com `plano='starter'`.
- **Cadastro test**: usa CNPJ inválido (`00000000000000`) para não acionar a busca automática de CNPJ. Os usuários criados por esses testes ficam no Supabase Auth — limpe periodicamente no dashboard.
