# CRM Studio — Instruções para Claude Code

> Este arquivo segue o `CLAUDE.md` da raiz (`/Users/edneyjunior/Documents/CRM-STUDIO/CLAUDE.md`), que é a fonte de verdade. Em caso de conflito, a raiz prevalece.

## O que é

CRM SaaS multi-tenant para PMEs brasileiras, construído sobre a base técnica do CRM Aurum (uso interno validado). Objetivo: produto vendável, white-label, sem branding da Aurum.

**CRM de representação comercial multi-solução:** gerencia portfólio de soluções de terceiros, clientes, pipeline de vendas e financeiro (contas a pagar/receber).

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript + React 19
- **UI:** Base UI (`@base-ui/react`) + Tailwind CSS v4 — **NÃO é shadcn/Radix.** Sem `asChild`; usa `render` prop. Ícones: `lucide-react`. Toasts: `sonner`. Animações: `motion`.
- **Banco:** Supabase (PostgreSQL + Auth + RLS + pg_cron)
- **Deploy:** Vercel (frontend) + Supabase (backend)
- **CI:** GitHub Actions

> ATENÇÃO Next 16: APIs e convenções podem diferir do seu conhecimento. Consulte `node_modules/next/dist/docs/` antes de escrever código de framework (ver `AGENTS.md`).

## Caminhos

- **Código (este repo):** `/Users/edneyjunior/Documents/CRM-STUDIO/app`
- **Base técnica de referência:** `/Users/edneyjunior/Documents/CRM Aurum`
- **Docs do projeto:** `/Users/edneyjunior/Documents/CRM-STUDIO/docs/O-QUE-TEMOS.md` (módulos implementados)

Pendências de produto: projeto Supabase próprio, des-Aurumização e multi-tenancy real.

## Como rodar

```bash
cd /Users/edneyjunior/Documents/CRM-STUDIO/app
npm run dev
```

App em http://localhost:3000.

## Estrutura

```
src/
  app/
    (auth)/                → login
    (crm)/                 → dashboard, clientes, solucoes, pipeline, financeiro,
                             contratos, parceiros, calendario, automacoes, fluxos,
                             configuracoes, minha-conta
    api/                   → API routes (sempre com auth check)
  lib/
    auth.ts                → getAuthUser() / getAuthFinanceiro() / getAuthAdmin()
    schemas.ts             → validação Zod
    supabase/              → server.ts (SSR) | client.ts (browser) | admin.ts (service role, bypassa RLS)
    utils.ts, moedas.ts, feriados.ts, aniversarios.ts, google-calendar.ts
```

## RBAC — Controle de Acesso

Roles na coluna `role` da tabela `profiles`: `admin`, `socio`, `comercial`.

| Módulo | admin | socio | comercial |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| Clientes / Pipeline | ✅ total | ✅ total | ✅ só os seus |
| Soluções | ✅ CRUD | 👁 leitura | 👁 leitura |
| Financeiro | ✅ total | ✅ total | ❌ nunca |
| Configurações | ✅ total | ❌ | ❌ |

## Schema do Banco (fonte da verdade)

```sql
profiles (id uuid PK ref auth.users, full_name, role, created_at)
solucoes (id, nome, empresa_representada, descricao, comissao_percentual, ativo, created_by)
clientes (id, razao_social, cnpj, contato_nome, contato_email, contato_telefone, segmento, observacoes, created_by)
negocios (id, cliente_id, solucao_id, responsavel_id, titulo, estagio, valor_estimado, probabilidade, data_previsao_fechamento, observacoes, created_at, updated_at)
-- estagio: prospeccao | qualificacao | proposta | negociacao | fechado_ganho | fechado_perdido
atividades (id, negocio_id, cliente_id, responsavel_id, tipo, descricao, data_atividade)
-- tipo: ligacao | email | reuniao | proposta | nota
contas_receber (id, negocio_id, cliente_id, descricao, valor, data_vencimento, data_recebimento, status, created_by)
contas_pagar (id, descricao, fornecedor, valor, data_vencimento, data_pagamento, categoria, status, created_by)
-- status: pendente | recebido/pago | atrasado | cancelado
```

> Após `ALTER TABLE` no Supabase: `NOTIFY pgrst, 'reload schema';`

## Convenções críticas

- **Base UI Select dentro de Dialog:** nunca confiar em `SelectValue` para UUIDs — renderizar o label do estado manualmente no trigger.
- **PostgREST FK ambígua:** tabelas com múltiplas FKs para a mesma tabela usam hint, ex: `profiles!responsavel_id(full_name)`.
- **Auth centralizado:** `src/lib/auth.ts` → `getAuthUser()`, `getAuthFinanceiro()`, `getAuthAdmin()`. Use essas funções em server components e API routes; redirect/401 quando sem permissão.
- **Validação:** Zod em `src/lib/schemas.ts`.
- **Erro Supabase:** nunca ignorar `error` — tratar e mostrar toast.
- **Valores:** `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)`.
- **Datas:** `date` para vencimento/pagamento, `timestamptz` para created/updated. Nunca `.toISOString()` para datas locais — usar `getFullYear/getMonth/getDate`.
- **UI:** mensagens em PT-BR, loading state em toda operação assíncrona, estado vazio com mensagem + CTA. Sempre reutilizar os componentes Base UI do projeto.

## Multi-tenant

A base do Aurum usa `created_by` + RLS por usuário. Para multi-tenant real (múltiplas empresas), adicionar `empresa_id` em todas as tabelas e uma tabela `empresas` com plano/limites.

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # NUNCA NEXT_PUBLIC_ — server only
```

## Skills

Há skills disponíveis no harness (ex.: `supabase`, `supabase-postgres-best-practices`, `code-review-skill`, `finish-branch`, `pt-br-grammar-review`, `ui-ux-pro-max`, `impeccable`, `web-quality-audit`, `update-config`). Use as que se aplicarem à tarefa; não dependa de agentes nomeados que não estejam listados no ambiente atual.
