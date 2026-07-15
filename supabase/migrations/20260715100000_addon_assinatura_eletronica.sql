-- ============================================================================
-- Add-on "Assinatura Eletrônica" (ZapSign) — venda, cobrança e gating
-- ============================================================================
-- Spec: .claude/specs/addon-assinatura-eletronica-zapsign.md
-- NÃO aplicar sozinho — o coordenador roda isso com OK do dono.
-- ============================================================================

-- 1) Catálogo — upsert idempotente (mesmo padrão de 20260617071401) -----------

insert into public.addons (slug, nome, descricao, preco_mensal, modulos, ativo, em_breve)
values ('assinatura_eletronica', 'Assinatura Eletrônica',
        'Envie contratos para assinatura digital com validade jurídica, direto do CRM.',
        49, '{}', true, false)
on conflict (slug) do update
  set nome=excluded.nome, descricao=excluded.descricao, preco_mensal=49,
      ativo=true, em_breve=false;

-- 2) Posse — public.empresa_addons ---------------------------------------------
--    Sem unique em (empresa_id, addon_slug) DE PROPÓSITO: add-ons quantitativos
--    (ex.: bloco de 10 usuários, próxima spec) precisam de MÚLTIPLAS linhas
--    ativas por empresa. "Só um ativo por empresa" (caso boolean, como este) é
--    garantido no momento da COMPRA (contratarAddon checa linha ativa antes de
--    criar) — não por constraint de schema. A idempotência do WEBHOOK vem do
--    `asaas_subscription_id unique` abaixo (replay de SUBSCRIPTION_CREATED
--    colide em 23505 e vira no-op).

create table if not exists public.empresa_addons (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  addon_slug            text not null,
  status                text not null check (status in ('ativo','atrasado','cancelado')),
  asaas_subscription_id text unique,          -- idempotência do webhook vem DAQUI
  valor                 numeric(10,2) not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

create index if not exists empresa_addons_empresa_idx on public.empresa_addons (empresa_id);

alter table public.empresa_addons enable row level security;

-- RLS: leitura para usuários da própria empresa; escrita só service_role
-- (quem escreve é o webhook — cliente nunca se auto-concede um add-on).
--
-- GOTCHA verificado ao ler 20260617090000_billing_transacional.sql: as
-- policies `assinaturas_select`/`assinaturas_update` daquela tabela são
-- declaradas `AS RESTRICTIVE`, mas `assinaturas` NÃO tem nenhuma policy
-- PERMISSIVE própria (é uma tabela nova do CRM Studio, não herdada do Aurum —
-- não passa pelo loop de `tenant_isolation` de 20260611180000, que só adiciona
-- a RESTRICTIVE por cima de uma PERMISSIVE pré-existente). Em Postgres, uma
-- policy só-RESTRICTIVE sem NENHUMA PERMISSIVE correspondente não concede
-- acesso nenhum (restrictive só ESTREITA o que uma permissive já liberou) —
-- ou seja, essas duas policies de `assinaturas` são hoje inertes para
-- `authenticated` (mesmo "deny-all" de `eventos_webhook`, só que sem o
-- comentário explícito). Não é um problema prático porque todo o código atual
-- só lê/escreve `assinaturas` via `createAdminClient()` (service role, que
-- bypassa RLS) — mas replicar o MESMO padrão aqui reproduziria o mesmo gotcha
-- pro `empresa_addons` (select ficaria inerte mesmo pra própria empresa).
--
-- Por isso a policy de select abaixo é PERMISSIVE (o padrão, sem `as
-- restrictive`) — replica a INTENÇÃO documentada em assinaturas_select
-- ("select para a própria empresa") de um jeito que realmente concede acesso,
-- em vez de copiar literalmente uma policy hoje sem efeito.
drop policy if exists empresa_addons_select on public.empresa_addons;
create policy empresa_addons_select on public.empresa_addons for select
  to authenticated
  using (empresa_id = public.current_empresa_id());

-- Sem policy de INSERT/UPDATE/DELETE para authenticated → default-deny.
-- Escrita só pelo service role (webhook), que bypassa RLS inteiramente.

notify pgrst, 'reload schema';
