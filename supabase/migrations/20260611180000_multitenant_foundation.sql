-- ============================================================================
-- CRM Studio — Fundação Multi-Tenant (M0) — versão ENDURECIDA
-- ============================================================================
-- Aplicar SOMENTE no projeto Supabase NOVO do CRM Studio, DEPOIS de todas as
-- migrations herdadas (001..020 + datadas) que criam as tabelas. NUNCA na Aurum.
--
-- Endurecimento aplicado a partir de docs/M0-MULTITENANT-AUDIT.md:
--   G1  inclui `parceiros_comissao` no loop de tenant (estava de fora → vazamento
--       entre tenants; ela já tem RLS+RBAC na 018, faltava só o empresa_id/isolamento).
--   G3  trigger set_empresa_id FORÇA a empresa do usuário (anti-spoofing) e bloqueia
--       insert órfão sem contexto de tenant.
--   G6  empresa_admin_update trava plano/status (admin não se auto-promove).
-- (Seção "authenticated rw" do audit foi OMITIDA de propósito: a 018 já tem o RBAC
--  certo na parceiros_comissao; aquela policy afrouxaria — deixaria comercial escrever.)
--
-- Isolamento: empresa_id + RLS RESTRICTIVE (faz AND com as PERMISSIVE de RBAC).
-- Banco novo e vazio → sem backfill (não há dados legados). Ver Seção 0 do audit
-- caso um dia migre dados existentes.
-- ============================================================================

-- 0) Tenants + vínculo + helpers ---------------------------------------------
create table if not exists public.empresas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  slug          text unique,
  plano         text not null default 'free'
                  check (plano in ('free','starter','pro','business')),
  status        text not null default 'trial'
                  check (status in ('trial','ativo','pendente','atrasado','suspenso','cancelado')),
  trial_ends_at timestamptz,
  ativo         boolean not null default true,
  config        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
alter table public.empresas enable row level security;

alter table public.profiles add column if not exists empresa_id uuid references public.empresas(id);
create index if not exists idx_profiles_empresa on public.profiles(empresa_id);

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

create or replace function public.current_empresa_id()
returns uuid language sql stable security definer set search_path = public
as $$ select empresa_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.platform_admins where user_id = auth.uid()) $$;

-- get_my_role() já vem da 001; recriado aqui defensivamente
create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- 1) Trigger de tenant: FORÇA a empresa do usuário (anti-spoofing). (G3) -------
create or replace function public.set_empresa_id()
returns trigger language plpgsql set search_path = public as $$
declare
  v_emp uuid := public.current_empresa_id();
begin
  if v_emp is not null then
    new.empresa_id := v_emp;                 -- carimba a própria empresa, ignora o que veio
  elsif new.empresa_id is null then
    raise exception 'empresa_id obrigatório: sem tenant no contexto (auth.uid()=%).', auth.uid();
  end if;
  return new;
end $$;

-- 2) Loop nas tabelas de domínio — LISTA COMPLETA (inclui parceiros_comissao). (G1)
--    Habilita RLS (idempotente), adiciona empresa_id+índice, trigger e RESTRICTIVE.
--    NÃO inclui as tabelas dos módulos Estoque/RH (criadas depois, já multi-tenant).
do $body$
declare
  t text;
  tabelas text[] := array[
    'agenda_bloqueios','atividades','bancos','calendario_contatos','calendario_eventos',
    'calendario_notas','calendario_notificacoes','clientes','comissoes_comercial',
    'contas_pagar','contas_receber','fluxo_cards','fluxo_colunas','fluxos','followups',
    'fornecedores','movimentacoes','negocios','parceiros','parceiros_comissao','solucoes'
  ];
begin
  foreach t in array tabelas loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'tabela % inexistente — pulada', t; continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I add column if not exists empresa_id uuid references public.empresas(id)', t);
    execute format('create index if not exists idx_%s_empresa on public.%I(empresa_id)', t, t);

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

-- 3) profiles — isolamento de tenant (vê só colegas da empresa; sempre vê a si). RESTRICTIVE
drop policy if exists tenant_isolation_profiles on public.profiles;
create policy tenant_isolation_profiles on public.profiles as restrictive for all
  using (empresa_id = public.current_empresa_id() or id = auth.uid())
  with check (empresa_id = public.current_empresa_id() or id = auth.uid());

-- 4) empresas — RLS. Admin edita a própria SEM trocar plano/status (billing). (G6)
drop policy if exists empresa_self_select on public.empresas;
create policy empresa_self_select on public.empresas for select
  using (id = public.current_empresa_id() or public.is_platform_admin());

drop policy if exists empresa_admin_update on public.empresas;
create policy empresa_admin_update on public.empresas for update
  using (id = public.current_empresa_id() and public.get_my_role() = 'admin')
  with check (
    id = public.current_empresa_id()
    and plano  = (select plano  from public.empresas e where e.id = empresas.id)
    and status = (select status from public.empresas e where e.id = empresas.id)
  );
-- (sem policy de INSERT/DELETE → default-deny; criação só via handle_new_user / service role)
revoke all on public.empresas from anon;
grant select, update on public.empresas to authenticated;

-- 5) handle_new_user multi-tenant --------------------------------------------
--    Convidado: metadata `empresa_id` → entra na empresa. Fundador: `empresa_nome`
--    → cria empresa e vira admin. Nenhum: empresa_id NULL (fail-closed).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_empresa_id uuid;
  v_role       text;
  v_meta_emp   text := new.raw_user_meta_data->>'empresa_id';
  v_emp_nome   text := new.raw_user_meta_data->>'empresa_nome';
begin
  if v_meta_emp is not null and v_meta_emp <> '' then
    v_empresa_id := v_meta_emp::uuid;
    v_role := coalesce(new.raw_user_meta_data->>'role', 'comercial');
  elsif v_emp_nome is not null and v_emp_nome <> '' then
    insert into public.empresas (nome, status, trial_ends_at)
    values (v_emp_nome, 'trial', now() + interval '14 days')
    returning id into v_empresa_id;
    v_role := 'admin';
  else
    v_empresa_id := null;
    v_role := coalesce(new.raw_user_meta_data->>'role', 'comercial');
  end if;

  insert into public.profiles (id, full_name, role, empresa_id)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.email),
          v_role, v_empresa_id)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users for each row
  execute function public.handle_new_user();

notify pgrst, 'reload schema';
