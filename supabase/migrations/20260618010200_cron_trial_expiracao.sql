-- ============================================================================
-- CRM Studio — pg_cron: suspender trials expirados
-- ============================================================================
-- Roda a cada hora (minuto 0 de cada hora UTC).
-- Empresas com status='trial' e trial_ends_at no passado → status='suspenso'.
-- Padrão: segue 014_cron_contas_atrasadas.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'suspender-trials-expirados',
  '0 * * * *',
  $$
  UPDATE public.empresas
  SET    status = 'suspenso'
  WHERE  status = 'trial'
    AND  trial_ends_at IS NOT NULL
    AND  trial_ends_at < now();
  $$
);
