-- ============================================================================
-- CRM Studio — Senha temporária pós-pagamento (trava de completar 1º acesso)
-- ============================================================================
-- Spec: .claude/specs/onboarding-senha-pos-pagamento.md
--
-- Contexto: a Parte A dessa spec tira a escolha de senha do /cadastro — o
-- sistema gera uma senha aleatória (nunca exibida, nunca logada) só para
-- satisfazer a API do Supabase Auth. Esta migration adiciona a coluna que
-- marca esse estado ("ainda estou com a senha aleatória, nunca troquei") e
-- recria handle_new_user() para setá-la true SOMENTE no ramo fundador —
-- convites e contas sem contexto continuam com o default false e nunca
-- passam pela trava (ver (crm)/layout.tsx + /definir-senha). Não retroativo:
-- contas já existentes já têm a coluna com default false.
-- ============================================================================

-- 1) profiles.senha_temporaria — aditiva, default false ----------------------

alter table public.profiles
  add column if not exists senha_temporaria boolean not null default false;

-- 2) handle_new_user() — igual à versão de 20260708120000_trial_com_cartao.sql,
--    exceto pelo INSERT em profiles, que agora seta senha_temporaria=true
--    exclusivamente no ramo fundador (quando v_emp_nome está presente).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_empresa_id          uuid;
  v_role                text;
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

  elsif v_emp_nome is not null and v_emp_nome <> '' then
    -- ---- Fluxo fundador: cria empresa + admin ----
    -- Trial com cartão obrigatório: a empresa nasce 'pendente_cartao' (sem
    -- acesso ao CRM — ver acessoLiberado() em src/lib/gating.ts) e só vira
    -- 'trial' (com trial_ends_at = now()+14d) quando o webhook do Asaas
    -- confirmar o cartão em SUBSCRIPTION_CREATED. Nunca setar 'trial'/
    -- trial_ends_at aqui — o webhook é a única fonte de verdade dessa transição.
    insert into public.empresas (
      nome,
      status,
      plano,
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
    -- Senha aleatória (Parte A da spec) — trava o 1º acesso até a pessoa
    -- definir a própria senha em /definir-senha (ver (crm)/layout.tsx).
    v_senha_temporaria := true;

  else
    -- ---- Sem contexto de empresa (fail-closed) ----
    v_empresa_id := null;
    v_role := coalesce(new.raw_user_meta_data->>'role', 'comercial');
  end if;

  insert into public.profiles (id, full_name, role, empresa_id, senha_temporaria)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    v_empresa_id,
    v_senha_temporaria
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- 3) Recarregar schema PostgREST ---------------------------------------------

notify pgrst, 'reload schema';
