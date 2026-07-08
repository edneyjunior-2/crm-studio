-- ============================================================================
-- CRM Studio — Trial com cartão obrigatório no cadastro
-- ============================================================================
-- Spec: .claude/specs/trial-com-cartao.md
-- Status: ESCRITA MAS NÃO APLICADA. Mexe no trigger de cadastro de TODOS os
-- tenants novos (handle_new_user) — aplicar só após revisão adversarial e OK
-- explícito do usuário.
--
-- Contexto: hoje o cadastro self-serve libera 14 dias de trial sem cartão
-- (status='trial' direto, ver 20260629180000_cadastro_plano_trial.sql). O novo
-- fluxo exige cartão no ato (Checkout hospedado do Asaas, validado mas não
-- cobrado); os 14 dias de trial só começam a contar quando o webhook confirma
-- SUBSCRIPTION_CREATED. Enquanto isso, a empresa fica em 'pendente_cartao'
-- (trial_ends_at NULL — o trial ainda não começou) e não acessa o CRM.
-- ============================================================================

-- 1) empresas.status — adiciona 'pendente_cartao' ao CHECK constraint --------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.empresas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.empresas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_status_check
  CHECK (status IN ('pendente_cartao', 'trial', 'ativo', 'pendente', 'atrasado', 'suspenso', 'cancelado'));

-- Nota: `assinaturas.status` NÃO precisa desse valor — uma assinatura só passa
-- a existir (linha em `assinaturas`) depois que o cartão é confirmado, quando
-- o status já é 'trial' (ver webhook, SUBSCRIPTION_CREATED). 'pendente_cartao'
-- é um estado exclusivo de `empresas`, nunca de `assinaturas`.

-- 2) empresas — colunas de rastreio do checkout em andamento -----------------
-- Usadas pela guarda de idempotência de iniciarCheckoutCartao() (Server Action
-- em src/app/(marketing)/cadastro/pagamento/actions.ts): evita criar dois
-- Checkouts/subscriptions no Asaas para a mesma empresa em duplo clique/F5.
-- Reaproveita o checkout já criado (mesmo link) enquanto a "reivindicação"
-- (asaas_checkout_criado_em) estiver dentro da janela de curto prazo definida
-- no código; fora da janela, um novo checkout pode ser criado (ex.: usuário
-- cancelou no Asaas e voltou bem depois para tentar de novo).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS asaas_checkout_url text,
  ADD COLUMN IF NOT EXISTS asaas_checkout_criado_em timestamptz;

-- 3) handle_new_user() — fluxo fundador passa a criar empresa 'pendente_cartao'
-- ============================================================================
-- Igual à versão anterior (20260629180000_cadastro_plano_trial.sql), exceto
-- pelo INSERT do fluxo fundador: status='pendente_cartao' e trial_ends_at=null
-- em vez de status='trial' + trial_ends_at=now()+14 dias. Os 14 dias só
-- começam a contar quando o webhook do Asaas confirmar o cartão
-- (SUBSCRIPTION_CREATED) — ver src/app/api/asaas/webhook/route.ts.
-- ============================================================================

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

-- 4) Recarregar schema PostgREST ---------------------------------------------

notify pgrst, 'reload schema';
