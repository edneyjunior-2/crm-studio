-- ============================================================================
-- CRM Studio — M1: LGPD — Encarregado/DPO na tabela empresas
-- ============================================================================
-- Adiciona as colunas de Encarregado pela Proteção de Dados (DPO) à tabela
-- `empresas`, permitindo que o admin da empresa registre o responsável LGPD.
-- Idempotente — usa ADD COLUMN IF NOT EXISTS.
-- ============================================================================

alter table public.empresas
  add column if not exists encarregado_nome     text,
  add column if not exists encarregado_email    text,
  add column if not exists encarregado_telefone text;

notify pgrst, 'reload schema';
