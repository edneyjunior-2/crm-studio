-- ============================================================================
-- CRM Studio — Planos verticais no checkout (Advocacia/Engenharia = planos)
-- ============================================================================
-- Spec: .claude/specs/planos-verticais-no-checkout.md
--
-- Contexto: o /precos vende Advocacia (R$247) e Engenharia (R$347) como
-- planos verticais de verdade, com módulos e preço próprios cobrados no
-- checkout do Asaas (fonte única de preço: src/lib/planos.ts — NUNCA em SQL).
-- Esta migration:
--   1. Amplia os CHECKs de empresas.plano e assinaturas.plano para aceitar
--      'advocacia'/'engenharia'.
--   2. Cria empresas.plano_contratado (nullable) — a escolha feita em
--      /cadastro?plano=X, capturada em user_metadata e gravada pelo trigger
--      no ramo fundador. NULL = empresa anterior a esta mudança (Saturnino,
--      Aurumtax, internos, qualquer cadastro anterior) → TRAVA
--      ANTI-RETROATIVO: todo código novo (checkout, webhook) é no-op para
--      ela e cai no comportamento de hoje (starter/R$147).
--   3. Recria handle_new_user() FIELMENTE — mesmos 3 ramos (convite / fundador
--      / sem-contexto) da versão vigente em
--      20260713190000_senha_temporaria_fundador.sql —, com a ÚNICA adição de
--      ler/validar plano_contratado e gravar modulos_ativos no ramo fundador.
-- ============================================================================

-- 1) empresas.plano — amplia CHECK -------------------------------------------

-- NOTA: o filtro exclui explicitamente qualquer CHECK de `plano_contratado`
-- (criado no passo 3). Sem isso, reaplicar esta migration — algo que ACONTECE
-- neste projeto, já que as migrations são rodadas à mão no SQL Editor —
-- derrubaria o CHECK de plano_contratado junto (a definição dele também casa
-- com '%plano%') e não o recriaria, porque o ADD COLUMN abaixo é IF NOT EXISTS
-- e vira no-op. A coluna ficaria sem validação, em silêncio.
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
  CHECK (plano IN ('free', 'trial', 'interno', 'starter', 'pro', 'business', 'advocacia', 'engenharia'));

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
  CHECK (plano IN ('free', 'trial', 'interno', 'starter', 'pro', 'business', 'advocacia', 'engenharia'));

-- 3) empresas.plano_contratado — aditiva, nullable, trava anti-retroativo ----
-- NULL de propósito: empresas existentes na hora em que esta migration roda
-- nunca recebem valor aqui (ALTER TABLE ADD COLUMN não faz backfill), então
-- todo código que checa `plano_contratado IS NULL` continua se comportando
-- exatamente como hoje para elas.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS plano_contratado text
    CHECK (plano_contratado IS NULL OR plano_contratado IN ('starter', 'pro', 'business', 'advocacia', 'engenharia'));

-- 4) handle_new_user() — recriação FIEL -------------------------------------
-- Igual à versão de 20260713190000_senha_temporaria_fundador.sql (3 ramos:
-- convite / fundador / sem-contexto), exceto pelo ramo fundador, que agora
-- também:
--   a) lê new.raw_user_meta_data->>'plano_contratado' (setado por
--      cadastro/actions.ts, já validado no servidor contra a mesma whitelist
--      de PLANOS_VENDAVEIS em src/lib/planos.ts — aqui validamos de novo, na
--      whitelist do banco, como defesa em profundidade: NULL/inválido cai em
--      'pro', igual ao PLANO_DEFAULT do TS);
--   b) grava empresas.plano_contratado com esse valor;
--   c) grava modulos_ativos = ARRAY['processos'] (advocacia) ou
--      ARRAY['obras','estoque'] (engenharia) — sem isso o trial não entrega o
--      módulo vertical (furo nº2 da spec). Nos demais planos, '{}' (mantém o
--      default de hoje).
-- empresas.plano continua 'trial' e status continua 'pendente_cartao' — não
-- mudamos isso. Nenhum preço em SQL.
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
    if v_plano_contratado is null or v_plano_contratado not in ('starter', 'pro', 'business', 'advocacia', 'engenharia') then
      v_plano_contratado := 'pro';
    end if;

    if v_plano_contratado = 'advocacia' then
      v_modulos_ativos := array['processos'];
    elsif v_plano_contratado = 'engenharia' then
      v_modulos_ativos := array['obras', 'estoque'];
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

notify pgrst, 'reload schema';
