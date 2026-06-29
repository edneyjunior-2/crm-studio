-- ============================================================================
-- CRM Studio — Planos: adiciona 'interno' e 'trial' aos CHECK constraints
-- ============================================================================
-- Contexto: admin pode criar empresas como 'interno' (sem cobrança) ou
-- 'trial' (7 dias), além dos planos pagos existentes (starter/pro/business).
-- O valor 'free' é mantido por compatibilidade com dados existentes.
-- ============================================================================

-- 1) empresas.plano ---------------------------------------------------------

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
  LOOP
    EXECUTE format('ALTER TABLE public.empresas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_plano_check
  CHECK (plano IN ('free', 'trial', 'interno', 'starter', 'pro', 'business'));

-- 2) assinaturas.plano ------------------------------------------------------

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
  CHECK (plano IN ('free', 'trial', 'interno', 'starter', 'pro', 'business'));

-- 3) Recarregar schema PostgREST --------------------------------------------

NOTIFY pgrst, 'reload schema';
