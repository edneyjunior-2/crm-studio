# CRM Aurum — Instruções pro Claude Code

## Protocolo de Execução — Máximo aproveitamento dos recursos

**ANTES de qualquer resposta ou execução**, seguir este protocolo obrigatório:

1. **Recrutar TODAS as Skills relevantes** — varrer a lista completa de skills disponíveis e identificar quais se aplicam à tarefa.
2. **Avaliar TODOS os agentes disponíveis** — identificar quais agentes podem contribuir para cada parte da tarefa.
3. **Compor a execução** — combinar skills + agentes para cobrir a tarefa com o máximo de especialização possível. Nenhum recurso disponível deve ser ignorado por desconhecimento.
4. **Paralelizar quando possível** — agentes e skills independentes devem rodar em paralelo, não em sequência.

> Objetivo: usar 100% da capacidade dos recursos disponíveis em cada execução, nunca resolver manualmente o que um agente especializado pode resolver melhor.

---

## Protocolo de Agentes — Avaliação automática obrigatória

**ANTES de qualquer resposta**, avaliar se o pedido se encaixa em algum agente disponível:

| Situação | Agente/Skill |
|---|---|
| Implementar feature, corrigir bug, qualquer mudança em múltiplos arquivos | `crm-builder` |
| Migrations, RLS, queries, schema, PostgREST | `crm-supabase` |
| Módulo financeiro, contas a pagar/receber, dashboard financeiro | `crm-financeiro` |
| Auditoria de segurança, RLS, roles, dados expostos | `crm-security` |
| Revisar código antes de PR | `code-review-skill` |
| Finalizar branch, merge, PR | `finish-branch` |
| UX, fluxo, design de telas | `ui-ux-pro-max` ou `impeccable` |
| Qualidade de página web | `web-quality-audit` |
| Postgres best practices | `supabase-postgres-best-practices` |
| Gramática PT-BR em textos da UI | `pt-br-grammar-review` |
| Configurar settings, hooks, permissões | `update-config` |

---

## Contexto do Projeto

**CRM de representação comercial multi-solução.**

A empresa representa múltiplas soluções de terceiros e precisa gerenciar: portfólio de soluções (editável), clientes (diferentes por solução), pipeline de vendas, e módulo financeiro (contas a pagar/receber).

**Time:** 4 usuários — 1 admin (Edney), 2 sócios, 1 comercial.

---

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **UI:** shadcn/ui + Tailwind CSS
- **Banco:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel (frontend) + Supabase (backend)
- **Repositório:** GitHub

---

## Estrutura de Pastas

```
src/
  app/
    (auth)/login/          → página de login
    (crm)/
      dashboard/           → visão geral
      clientes/            → gestão de clientes
      solucoes/            → catálogo de soluções representadas
      pipeline/            → funil de vendas (Kanban)
      financeiro/          → contas a pagar/receber [admin + socio]
      configuracoes/       → usuários, roles, settings [admin only]
    api/                   → API routes (sempre com auth check)
  components/
    ui/                    → shadcn/ui
    crm/                   → componentes do domínio
  lib/
    supabase/
      server.ts            → cliente SSR
      client.ts            → cliente browser
      admin.ts             → service role (bypassa RLS)
    utils.ts
  types/                   → interfaces TypeScript do domínio
```

---

## RBAC — Controle de Acesso

| Módulo | admin | socio | comercial |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| Clientes | ✅ total | ✅ total | ✅ só os seus |
| Soluções | ✅ CRUD | 👁 leitura | 👁 leitura |
| Pipeline | ✅ total | ✅ total | ✅ só os seus |
| Financeiro | ✅ total | ✅ total | ❌ nunca |
| Configurações | ✅ total | ❌ | ❌ |

**Roles no banco:** `admin`, `socio`, `comercial` (campo `role` na tabela `profiles`)

---

## Schema do Banco (fonte da verdade)

```sql
-- Perfis ligados ao auth.users
profiles (id uuid PK ref auth.users, full_name text, role text, created_at)

-- Catálogo de soluções representadas (editável pelo admin)
solucoes (id, nome, empresa_representada, descricao, comissao_percentual, ativo, created_by)

-- Clientes (diferentes por solução)
clientes (id, razao_social, cnpj, contato_nome, contato_email, contato_telefone, segmento, observacoes, created_by)

-- Negócios no pipeline
negocios (id, cliente_id, solucao_id, responsavel_id, titulo, estagio, valor_estimado, probabilidade, data_previsao_fechamento, observacoes, created_at, updated_at)
-- estagio: prospeccao | qualificacao | proposta | negociacao | fechado_ganho | fechado_perdido

-- Atividades / histórico
atividades (id, negocio_id, cliente_id, responsavel_id, tipo, descricao, data_atividade)
-- tipo: ligacao | email | reuniao | proposta | nota

-- Financeiro (acesso restrito)
contas_receber (id, negocio_id, cliente_id, descricao, valor, data_vencimento, data_recebimento, status, created_by)
contas_pagar (id, descricao, fornecedor, valor, data_vencimento, data_pagamento, categoria, status, created_by)
-- status: pendente | recebido/pago | atrasado | cancelado
```

---

## Convenções de Código

### Auth em server components
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
```

### Auth em API routes
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
```

### Check de role para financeiro
```typescript
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
if (!['admin', 'socio'].includes(profile?.role)) redirect('/dashboard')
```

### Erro Supabase — nunca ignorar
```typescript
const { data, error } = await supabase.from('...').insert(...)
if (error) { /* mostrar toast de erro */ return }
```

### Valores monetários
```typescript
// Sempre formatar BRL
new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
```

### Datas
- `date` para vencimento/pagamento (sem timezone)
- `timestamptz` para created_at/updated_at
- Nunca usar `.toISOString()` para datas locais — usar `getFullYear/getMonth/getDate` manual

### UI
- Mensagens sempre em PT-BR
- Sempre shadcn/ui — sem reinventar componentes base
- Loading state em toda operação assíncrona
- Estado vazio com mensagem + call-to-action

---

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # NUNCA NEXT_PUBLIC_ — server only
```

---

## Como rodar

```bash
cd "/Users/edneyjunior/Documents/projeto CRM Aurum"
npm run dev
```

App em: http://localhost:3000

---

## Após ALTER TABLE no Supabase

```sql
NOTIFY pgrst, 'reload schema';
```
