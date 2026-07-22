-- ============================================================================
-- CRM Studio — Papéis customizáveis por empresa (Fase 1: fundação)
-- ============================================================================
-- Spec: .claude/specs/papeis-customizaveis-01-fundacao.md
--
-- Fase 1 é 100% ADITIVA: cria a tabela `papeis` + `profiles.papel_id`, mas
-- `profiles.role` continua sendo a ÚNICA fonte de verdade de permissão nesta
-- fase — nenhuma RLS de negócio, nenhum ponto de `auth.ts`/`gating.ts` além dos
-- 2 campos novos expostos, e nenhum dos ~80 pontos de `role === '...'` no app
-- mudam aqui. O único comportamento novo visível: o admin pode RENOMEAR o
-- papel (nome exibido em Configurações › Usuários), sem alterar permissão.
--
-- `role_sistema` é a ÂNCORA funcional do papel (não o `nome`, que é editável)
-- — mesmo princípio já usado em pipeline_estagios.tipo: automação/lookup
-- nunca depende de texto que o usuário pode reescrever.
-- ============================================================================

-- 1) Tabela `papeis` -----------------------------------------------------------
create table if not exists public.papeis (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id),
  nome          text not null,
  -- Âncora funcional para papéis "de sistema" (espelham profiles.role). NULL
  -- fica reservado pra papel 100% customizado (Fase 3) — não usado ainda.
  role_sistema  text check (role_sistema in ('admin', 'socio', 'comercial', 'parceiro')),
  sistema       boolean not null default false,
  -- Esqueleto pra Fase 2/3 — nenhum código lê este campo nesta fase.
  permissoes    jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint papeis_nome_unico_por_empresa unique (empresa_id, nome),
  constraint papeis_role_sistema_unico_por_empresa unique (empresa_id, role_sistema)
);

alter table public.papeis enable row level security;

create index if not exists idx_papeis_empresa on public.papeis(empresa_id);

-- RLS: RESTRICTIVE tenant_isolation (mesmo padrão de toda tabela de domínio) +
-- leitura livre pra qualquer um da empresa (precisa ver o nome do próprio
-- papel) + escrita (insert/update/delete) restrita a admin nesta fase.
drop policy if exists tenant_isolation on public.papeis;
create policy tenant_isolation on public.papeis as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

drop policy if exists papeis_select_all on public.papeis;
create policy papeis_select_all on public.papeis for select
  using (true);

drop policy if exists papeis_admin_insert on public.papeis;
create policy papeis_admin_insert on public.papeis for insert
  with check (public.get_my_role() = 'admin');

drop policy if exists papeis_admin_update on public.papeis;
create policy papeis_admin_update on public.papeis for update
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- Papel de sistema (sistema=true) nunca pode ser apagado (AC7) — só os 4
-- papéis "de sistema" existem nesta fase, e travar o delete deles aqui evita
-- reintroduzir a possibilidade de uma empresa ficar sem o papel Administrador.
drop policy if exists papeis_admin_delete on public.papeis;
create policy papeis_admin_delete on public.papeis for delete
  using (public.get_my_role() = 'admin' and sistema = false);

-- Carimba empresa_id automaticamente (reusa o set_empresa_id() já usado em
-- toda tabela de domínio — 20260611180000_multitenant_foundation.sql).
drop trigger if exists trg_set_empresa on public.papeis;
create trigger trg_set_empresa before insert on public.papeis
  for each row execute function public.set_empresa_id();

-- updated_at (reusa set_updated_at() já existente — 001_initial_schema.sql).
drop trigger if exists trg_papeis_updated_at on public.papeis;
create trigger trg_papeis_updated_at before update on public.papeis
  for each row execute function public.set_updated_at();

-- 2) profiles.papel_id ---------------------------------------------------------
alter table public.profiles add column if not exists papel_id uuid references public.papeis(id);
create index if not exists idx_profiles_papel on public.profiles(papel_id);

-- 3) protege_privilegio_profile — estende pra bloquear auto-alteração de
--    papel_id (mesma lógica já aplicada a role/empresa_id/modulos_permitidos
--    em 20260701200000_protege_privilegio_profile.sql). O trigger que já
--    existe (trg_protege_privilegio_profile) só precisa da função atualizada
--    — CREATE OR REPLACE não exige recriar o trigger.
create or replace function public.protege_privilegio_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');

  -- service_role (admin client do servidor) tem passe livre — o app já gateia via getAuthAdmin.
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- O usuário NÃO pode alterar os próprios privilégios pela API do usuário.
  if new.id = auth.uid() then
    if new.role is distinct from old.role then
      raise exception 'Alteração de role não permitida.' using errcode = '42501';
    end if;
    if new.empresa_id is distinct from old.empresa_id and old.empresa_id is not null then
      raise exception 'Alteração de empresa não permitida.' using errcode = '42501';
    end if;
    if new.modulos_permitidos is distinct from old.modulos_permitidos then
      raise exception 'Alteração de módulos não permitida.' using errcode = '42501';
    end if;
    if new.papel_id is distinct from old.papel_id then
      raise exception 'Alteração de papel não permitida.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- 4) handle_new_user — cria o papel "Administrador" pro fundador + resolve
--    papel_id no fluxo de convite. Cópia fiel da versão vigente
--    (20260716140000_plano_vertical_frete.sql), com a única adição sendo
--    v_papel_id (calculado/criado em cada ramo) e o novo campo no insert final.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_empresa_id          uuid;
  v_role                text;
  v_papel_id            uuid;
  v_senha_temporaria    boolean := false;
  v_meta_emp            text := new.raw_user_meta_data->>'empresa_id';
  v_emp_nome            text := new.raw_user_meta_data->>'empresa_nome';
  v_cnpj                text := new.raw_user_meta_data->>'cnpj';
  v_razao_social        text := new.raw_user_meta_data->>'razao_social';
  v_nome_fantasia       text := new.raw_user_meta_data->>'nome_fantasia';
  v_cpf                 text := new.raw_user_meta_data->>'cpf';
  v_tipo_pessoa         text := new.raw_user_meta_data->>'tipo_pessoa';
  v_aceite_versao       text := new.raw_user_meta_data->>'aceite_termos_versao';
  v_aceite_em_txt       text := new.raw_user_meta_data->>'aceite_em';
  v_aceite_em           timestamptz;
  v_plano_contratado    text := new.raw_user_meta_data->>'plano_contratado';
  v_modulos_ativos      text[] := '{}';
begin
  begin
    if v_aceite_em_txt is not null and v_aceite_em_txt <> '' then
      v_aceite_em := v_aceite_em_txt::timestamptz;
    end if;
  exception when others then
    v_aceite_em := now();
  end;

  if v_meta_emp is not null and v_meta_emp <> '' then
    -- ---- Fluxo convite: entra na empresa existente ----
    v_empresa_id := v_meta_emp::uuid;
    v_role := coalesce(new.raw_user_meta_data->>'role', 'comercial');
    -- Papel de sistema equivalente já deve existir (backfill roda pra toda
    -- empresa existente; empresa nova ganha os 4 no ramo fundador abaixo).
    -- Fail-soft: se por algum motivo não existir, papel_id fica NULL — Fase 1
    -- não depende de papel_id pra nada funcionar, só profiles.role.
    select id into v_papel_id from public.papeis
      where empresa_id = v_empresa_id and role_sistema = v_role
      limit 1;

  elsif v_emp_nome is not null and v_emp_nome <> '' then
    -- ---- Fluxo fundador: cria empresa + admin ----
    -- Trial com cartão obrigatório: a empresa nasce 'pendente_cartao' (sem
    -- acesso ao CRM — ver acessoLiberado() em src/lib/gating.ts) e só vira
    -- 'trial' (com trial_ends_at = now()+14d) quando o webhook do Asaas
    -- confirmar o cartão em SUBSCRIPTION_CREATED. Nunca setar 'trial'/
    -- trial_ends_at aqui — o webhook é a única fonte de verdade dessa transição.
    --
    -- plano_contratado (spec planos-verticais-no-checkout.md): NULL ou fora da
    -- whitelist cai em 'pro' (nota: `is null` explícito porque `NULL NOT IN
    -- (...)` avalia NULL em SQL — não FALSE —, e um `IF NULL THEN` em plpgsql
    -- NÃO entra no branch; sem essa checagem um cadastro sem plano_contratado
    -- gravaria NULL em vez de cair no default).
    if v_plano_contratado is null or v_plano_contratado not in ('starter', 'pro', 'business', 'advocacia', 'engenharia', 'frete') then
      v_plano_contratado := 'pro';
    end if;

    if v_plano_contratado = 'advocacia' then
      v_modulos_ativos := array['processos'];
    elsif v_plano_contratado = 'engenharia' then
      v_modulos_ativos := array['obras', 'estoque'];
    elsif v_plano_contratado = 'frete' then
      v_modulos_ativos := array['frete'];
    else
      v_modulos_ativos := '{}';
    end if;

    insert into public.empresas (
      nome,
      status,
      plano,
      plano_contratado,
      modulos_ativos,
      trial_ends_at,
      cnpj,
      razao_social,
      nome_fantasia,
      cpf,
      tipo_pessoa,
      aceite_termos_versao,
      aceite_termos_em
    )
    values (
      v_emp_nome,
      'pendente_cartao',
      'trial',
      v_plano_contratado,
      v_modulos_ativos,
      null,
      v_cnpj,
      v_razao_social,
      v_nome_fantasia,
      v_cpf,
      v_tipo_pessoa,
      v_aceite_versao,
      coalesce(v_aceite_em, now())
    )
    returning id into v_empresa_id;
    v_role := 'admin';
    -- Senha aleatória (Parte A da spec onboarding-senha-pos-pagamento.md) —
    -- trava o 1º acesso até a pessoa definir a própria senha em /definir-senha
    -- (ver (crm)/layout.tsx).
    v_senha_temporaria := true;

    -- Empresa nova já nasce com o papel de sistema "Administrador" (AC3 da
    -- spec papeis-customizaveis-01-fundacao.md) — sem passo manual.
    insert into public.papeis (empresa_id, nome, role_sistema, sistema)
    values (v_empresa_id, 'Administrador', 'admin', true)
    returning id into v_papel_id;

  else
    -- ---- Sem contexto de empresa (fail-closed) ----
    v_empresa_id := null;
    v_role := coalesce(new.raw_user_meta_data->>'role', 'comercial');
  end if;

  insert into public.profiles (id, full_name, role, empresa_id, senha_temporaria, papel_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    v_empresa_id,
    v_senha_temporaria,
    v_papel_id
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- 5) Recarregar schema PostgREST -----------------------------------------------

NOTIFY pgrst, 'reload schema';
