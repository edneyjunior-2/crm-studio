-- ============================================================================
-- CRM Studio — Vertical Frete e Logística (plano de verdade, R$397/mês)
-- ============================================================================
-- Spec: .claude/specs/frete-01-backend-schema-antt.md
--
-- Contexto: novo vertical "Frete e Logística" para transportadoras (decidido
-- em research/25-modulo-frete-logistica-transportadora.md), preço fechado
-- R$397/mês, vertical exclusivo (nunca se mistura com processos/obras — regra
-- já existente para advocacia/engenharia). Segue exatamente o padrão de
-- 20260714150000_planos_verticais.sql para advocacia/engenharia:
--   1. Amplia os CHECKs de empresas.plano, assinaturas.plano e
--      empresas.plano_contratado para aceitar 'frete'.
--   2. Recria handle_new_user() FIELMENTE (mesmos 3 ramos: convite/fundador/
--      sem-contexto, copiados de 20260714150000_planos_verticais.sql), com a
--      ÚNICA adição, dentro do ramo fundador: quando plano_contratado='frete',
--      modulos_ativos := array['frete'].
--   3. NOTIFY pgrst no fim.
-- ============================================================================

-- 1) empresas.plano — amplia CHECK -------------------------------------------

-- Mesmo filtro defensivo do que 20260714150000: exclui qualquer CHECK de
-- `plano_contratado` (tratado no passo 3) para não derrubá-lo por engano caso
-- esta migration seja reaplicada à mão (prática comum neste projeto).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.empresas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%plano%'
      AND pg_get_constraintdef(oid) NOT LIKE '%plano_contratado%'
  LOOP
    EXECUTE format('ALTER TABLE public.empresas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_plano_check
  CHECK (plano IN ('free', 'trial', 'interno', 'starter', 'pro', 'business', 'advocacia', 'engenharia', 'frete'));

-- 2) assinaturas.plano — amplia CHECK -----------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.assinaturas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%plano%'
  LOOP
    EXECUTE format('ALTER TABLE public.assinaturas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.assinaturas
  ADD CONSTRAINT assinaturas_plano_check
  CHECK (plano IN ('free', 'trial', 'interno', 'starter', 'pro', 'business', 'advocacia', 'engenharia', 'frete'));

-- 3) empresas.plano_contratado — amplia CHECK ---------------------------------
-- Coluna já existe (criada nullable em 20260714150000); aqui só ampliamos a
-- whitelist de vendáveis para incluir 'frete'. Mesmo cuidado defensivo: busca
-- o CHECK pelo texto da definição em vez de assumir o nome exato do
-- constraint (auto-gerado como empresas_plano_contratado_check na criação,
-- mas não custa não depender disso).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.empresas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%plano_contratado%'
  LOOP
    EXECUTE format('ALTER TABLE public.empresas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_plano_contratado_check
  CHECK (plano_contratado IS NULL OR plano_contratado IN ('starter', 'pro', 'business', 'advocacia', 'engenharia', 'frete'));

-- 4) handle_new_user() — recriação FIEL -------------------------------------
-- Cópia literal da versão vigente (20260714150000_planos_verticais.sql), com
-- as únicas duas mudanças: a whitelist de validação de plano_contratado passa
-- a aceitar 'frete', e o ramo fundador ganha um elsif gravando
-- modulos_ativos = ARRAY['frete'] quando plano_contratado='frete' — sem isso o
-- trial não entregaria o módulo vertical (mesmo furo que a spec-irmã corrigiu
-- para advocacia/engenharia).
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

-- 5) Recarregar schema PostgREST ---------------------------------------------

NOTIFY pgrst, 'reload schema';
