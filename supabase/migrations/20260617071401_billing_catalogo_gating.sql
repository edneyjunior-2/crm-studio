-- ============================================================================
-- CRM Studio — M2 Stream 1: Fundação de Planos + Gating (catálogo + coluna)
-- ============================================================================
-- Adiciona empresas.modulos_ativos e cria as tabelas de catálogo de billing:
--   modulos_catalogo, planos, addons.
-- Seed idempotente com on conflict do nothing/do update.
-- NÃO aplicar no banco manualmente — o Opus aplica com OK do dono.
-- PREÇOS, COMPOSIÇÃO DE PLANOS E LIMITES SÃO PROVISÓRIOS (a confirmar).
-- ============================================================================

-- 1) Coluna de override por empresa (add-ons / cortesia) ----------------------

alter table public.empresas
  add column if not exists modulos_ativos text[] not null default '{}';

-- 2) Catálogo de módulos -------------------------------------------------------

create table if not exists public.modulos_catalogo (
  slug      text primary key,
  nome      text not null,
  rota      text not null,
  reservado boolean not null default false,
  ordem     int not null default 0
);

alter table public.modulos_catalogo enable row level security;

-- Catálogo legível por qualquer usuário autenticado; escrita apenas pelo service role / super-admin.
drop policy if exists catalogo_select on public.modulos_catalogo;
create policy catalogo_select on public.modulos_catalogo as permissive for select
  to authenticated
  using (true);

-- 3) Catálogo de planos --------------------------------------------------------

create table if not exists public.planos (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nome         text not null,
  -- PROVISÓRIO: preços sujeitos a ajuste sem reconstrução
  preco_mensal numeric(10,2) not null default 0,
  modulos      text[] not null default '{}',
  ativo        boolean not null default true,
  ordem        int not null default 0
);

alter table public.planos enable row level security;

-- Catálogo legível por qualquer usuário autenticado; escrita apenas pelo service role / super-admin.
drop policy if exists catalogo_select on public.planos;
create policy catalogo_select on public.planos as permissive for select
  to authenticated
  using (true);

-- 4) Catálogo de add-ons -------------------------------------------------------

create table if not exists public.addons (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nome         text not null,
  descricao    text,
  -- PROVISÓRIO: preço a definir (null = em breve)
  preco_mensal numeric(10,2),
  modulos      text[] not null default '{}',
  ativo        boolean not null default false,
  em_breve     boolean not null default false
);

alter table public.addons enable row level security;

-- Catálogo legível por qualquer usuário autenticado; escrita apenas pelo service role / super-admin.
drop policy if exists catalogo_select on public.addons;
create policy catalogo_select on public.addons as permissive for select
  to authenticated
  using (true);

-- 5) Seed idempotente — módulos -----------------------------------------------
-- reservado=false para todos: estoque e rh já estão construídos (M7 concluído).
-- PROVISÓRIO: ordem e rota podem mudar.

insert into public.modulos_catalogo (slug, nome, rota, reservado, ordem) values
  ('pipeline',   'Pipeline',   '/pipeline',              false,  1),
  ('clientes',   'Clientes',   '/clientes',              false,  2),
  ('solucoes',   'Soluções',   '/solucoes',              false,  3),
  ('parceiros',  'Parceiros',  '/parceiros',             false,  4),
  ('financeiro', 'Financeiro', '/financeiro',            false,  5),
  ('comissoes',  'Comissões',  '/financeiro/comissoes',  false,  6),
  ('fluxos',     'Fluxos',     '/fluxos',                false,  7),
  ('calendario', 'Calendário', '/calendario',            false,  8),
  ('contratos',  'Contratos',  '/contratos',             false,  9),
  ('automacoes', 'Automações', '/automacoes',            false, 10),
  ('estoque',    'Estoque',    '/estoque',               false, 11),
  ('rh',         'RH',         '/rh',                    false, 12)
on conflict (slug) do nothing;

-- 6) Seed idempotente — planos -------------------------------------------------
-- PROVISÓRIO: preços 0/97/197/397 e composição dos módulos (a confirmar com produto).
--   free     → isca de aquisição: CRM básico
--   starter  → free + colaboração (sem financeiro)
--   pro      → tudo de CRM + financeiro + comissoes + automacoes (produto completo atual)
--   business → pro + estoque + rh (tier de upsell pós-M7)

insert into public.planos (slug, nome, preco_mensal, modulos, ativo, ordem) values
  ('free',
   'Free',
   0.00,
   array['pipeline','clientes','solucoes','calendario'],
   true,
   1),
  ('starter',
   'Starter',
   97.00,
   array['pipeline','clientes','solucoes','calendario','parceiros','fluxos','contratos'],
   true,
   2),
  ('pro',
   'Pro',
   197.00,
   array['pipeline','clientes','solucoes','calendario','parceiros','fluxos','contratos',
         'financeiro','comissoes','automacoes'],
   true,
   3),
  ('business',
   'Business',
   397.00,
   array['pipeline','clientes','solucoes','calendario','parceiros','fluxos','contratos',
         'financeiro','comissoes','automacoes','estoque','rh'],
   true,
   4)
on conflict (slug) do update set
  nome         = excluded.nome,
  preco_mensal = excluded.preco_mensal,
  modulos      = excluded.modulos,
  ativo        = excluded.ativo,
  ordem        = excluded.ordem;

-- 7) Seed idempotente — add-ons ------------------------------------------------
-- PROVISÓRIO: ambos "em breve" (ativo=false, em_breve=true, preco a definir).
--   gerador_contratos → libera módulo 'contratos' (avançado, em breve)
--   sdr_whatsapp      → módulo futuro 'sdr' (em breve; slug não existe ainda no catálogo)

insert into public.addons (slug, nome, descricao, preco_mensal, modulos, ativo, em_breve) values
  ('gerador_contratos',
   'Gerador de Contratos',
   'Geração automática de contratos com IA, assinatura eletrônica e templates personalizados.',
   null,
   array['contratos'],
   false,
   true),
  ('sdr_whatsapp',
   'SDR WhatsApp',
   'Assistente de prospecção ativo via WhatsApp com IA — módulo futuro.',
   null,
   array['sdr'],
   false,
   true)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
