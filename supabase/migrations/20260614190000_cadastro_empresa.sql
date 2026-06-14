-- ============================================================================
-- CRM Studio — M1: Cadastro self-serve (PF e PJ) + aceite de Termos/DPA
-- ============================================================================
-- Estende a tabela `empresas` com campos de PJ/PF e registra o aceite.
-- Atualiza handle_new_user para gravar esses campos a partir do metadata.
-- NÃO altera o fluxo de convite (metadata empresa_id) — permanece intacto.
-- ============================================================================

-- 1) Novas colunas em empresas -------------------------------------------

alter table public.empresas
  add column if not exists cnpj              text,
  add column if not exists razao_social      text,
  add column if not exists nome_fantasia     text,
  add column if not exists cpf              text,
  add column if not exists tipo_pessoa       text
    check (tipo_pessoa in ('pf', 'pj')),
  add column if not exists aceite_termos_versao text,
  add column if not exists aceite_termos_em    timestamptz;

-- 2) handle_new_user — CREATE OR REPLACE mantendo o fluxo de convite ------
--    Fundador: metadata `empresa_nome` → cria empresa e vira admin.
--             Novos campos (cnpj, razao_social, nome_fantasia, cpf, tipo_pessoa,
--             aceite_termos_versao, aceite_termos_em) são gravados no INSERT.
--    Convidado: metadata `empresa_id` → entra na empresa existente.
--    Nenhum: empresa_id NULL (fail-closed).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_empresa_id          uuid;
  v_role                text;
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
  -- Parse do timestamp de aceite (enviado como ISO string sem zona = local)
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
    insert into public.empresas (
      nome,
      status,
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
      'trial',
      now() + interval '14 days',
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

  else
    -- ---- Sem contexto de empresa (fail-closed) ----
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

notify pgrst, 'reload schema';
