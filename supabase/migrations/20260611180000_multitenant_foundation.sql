-- ============================================================================
-- CRM Studio — Fundação Multi-Tenant (M0)
-- ============================================================================
-- Aplicar SOMENTE no projeto Supabase NOVO do CRM Studio, DEPOIS de todas as
-- migrations herdadas (001..020 + datadas) que criam as tabelas. NUNCA no banco
-- da Aurum.
--
-- Estratégia: isolamento por `empresa_id` + RLS RESTRICTIVE. Policies restritivas
-- fazem AND com as policies permissivas de RBAC (admin/sócio/comercial) que já
-- existem — o RBAC é PRESERVADO e ganha por cima a camada "só a sua empresa".
-- Um trigger preenche empresa_id automaticamente no insert das tabelas de domínio.
--
-- Decisões de produto travadas (ver docs/BLUEPRINT-SAAS.md):
--   - Planos fechados: free | starter | pro | business (cada plano embute módulos).
--   - Preço FLAT por empresa (não por usuário).
-- ============================================================================

-- 1) Tabela de tenants (empresas/clientes do SaaS) -----------------------------
create table if not exists public.empresas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  slug           text unique,                           -- subdomínio futuro: clientex.crmstudio.com.br
  plano          text not null default 'free'
                   check (plano in ('free','starter','pro','business')),
  status         text not null default 'trial'          -- ciclo de vida da assinatura (M2/Asaas)
                   check (status in ('trial','ativo','pendente','atrasado','suspenso','cancelado')),
  trial_ends_at  timestamptz,
  ativo          boolean not null default true,
  config         jsonb not null default '{}'::jsonb,    -- branding (logo_url, cores) + dados fiscais do contrato
  created_at     timestamptz not null default now()
);
alter table public.empresas enable row level security;

-- 2) Vínculo usuário -> empresa ------------------------------------------------
alter table public.profiles add column if not exists empresa_id uuid references public.empresas(id);

-- 3) Empresa do usuário logado (SECURITY DEFINER p/ ler profiles sem esbarrar na RLS)
create or replace function public.current_empresa_id()
returns uuid language sql stable security definer set search_path = public
as $$ select empresa_id from public.profiles where id = auth.uid() $$;

-- 4) Dono da PLATAFORMA (você) — distinto do `admin`, que é dono de UMA empresa.
--    Usado pelo Dashboard Admin (M3). Fica fora da RLS de tenant.
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.platform_admins where user_id = auth.uid()) $$;

-- 5) Trigger genérico: preenche empresa_id no insert quando vier nulo -----------
create or replace function public.set_empresa_id()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.empresa_id is null then
    new.empresa_id := public.current_empresa_id();
  end if;
  return new;
end $$;

-- 6) empresa_id + índice + trigger + isolamento RESTRICTIVE nas tabelas de domínio
--    ⚠️ Verifique que TODAS as tabelas de domínio do schema estão nesta lista.
do $body$
declare
  t text;
  tabelas text[] := array[
    'agenda_bloqueios','atividades','bancos','calendario_contatos','calendario_eventos',
    'calendario_notas','calendario_notificacoes','clientes','comissoes_comercial',
    'contas_pagar','contas_receber','fluxo_cards','fluxo_colunas','fluxos','followups',
    'fornecedores','movimentacoes','negocios','parceiros','solucoes'
  ];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I add column if not exists empresa_id uuid references public.empresas(id)', t);
    execute format('create index if not exists idx_%I_empresa on public.%I(empresa_id)', t, t);
    execute format('drop trigger if exists trg_set_empresa on public.%I', t);
    execute format('create trigger trg_set_empresa before insert on public.%I for each row execute function public.set_empresa_id()', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I as restrictive for all '
      'using (empresa_id = public.current_empresa_id()) '
      'with check (empresa_id = public.current_empresa_id())', t);
  end loop;
end
$body$;

-- 7) Isolamento em profiles (usuário só enxerga colegas da própria empresa) -----
drop policy if exists tenant_isolation_profiles on public.profiles;
create policy tenant_isolation_profiles on public.profiles as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- 8) RLS da tabela empresas ----------------------------------------------------
drop policy if exists empresa_self_select on public.empresas;
create policy empresa_self_select on public.empresas for select
  using (id = public.current_empresa_id());

-- admin da empresa pode editar a própria empresa (nome, logo, config) — não o plano/status
drop policy if exists empresa_admin_update on public.empresas;
create policy empresa_admin_update on public.empresas for update
  using (id = public.current_empresa_id() and public.get_my_role() = 'admin')
  with check (id = public.current_empresa_id());

-- 9) handle_new_user — agora multi-tenant. Substitui o trigger da migration 001.
--    REGRAS:
--      * Convidado (admin adiciona membro): metadata traz `empresa_id` -> entra na empresa existente.
--      * Fundador (cadastro self-serve):    metadata traz `empresa_nome` -> CRIA empresa nova e vira admin.
--      * Nenhum dos dois (criação manual no dashboard): profile com empresa_id NULL (fail-closed: não vê nada).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_empresa_id uuid;
  v_role       text;
  v_meta_emp   text := new.raw_user_meta_data->>'empresa_id';
  v_emp_nome   text := new.raw_user_meta_data->>'empresa_nome';
begin
  if v_meta_emp is not null and v_meta_emp <> '' then
    -- Convidado: entra na empresa do admin que o criou.
    v_empresa_id := v_meta_emp::uuid;
    v_role := coalesce(new.raw_user_meta_data->>'role', 'comercial');
  elsif v_emp_nome is not null and v_emp_nome <> '' then
    -- Fundador: cria a própria empresa (trial de 14 dias) e vira admin.
    insert into public.empresas (nome, status, trial_ends_at)
    values (v_emp_nome, 'trial', now() + interval '14 days')
    returning id into v_empresa_id;
    v_role := 'admin';
  else
    v_empresa_id := null;
    v_role := coalesce(new.raw_user_meta_data->>'role', 'comercial');
  end if;

  insert into public.profiles (id, full_name, role, empresa_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    v_empresa_id
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- (o trigger trg_on_auth_user_created da migration 001 continua apontando p/ esta função)

-- ============================================================================
-- ⚠️ AO APLICAR — ver docs/M0-SETUP-SUPABASE.md:
--  - Rodar este arquivo POR ÚLTIMO (depois das migrations que criam as tabelas).
--  - Criar a 1ª empresa + seu admin via cadastro self-serve OU seed manual.
--  - Registrar você como platform_admin: insert into platform_admins(user_id) ...
--  - Se migrar dados existentes: criar 1 empresa e backfill
--    `update <tabela> set empresa_id = '<id>'` em massa ANTES de confiar na RLS.
-- ============================================================================
notify pgrst, 'reload schema';
