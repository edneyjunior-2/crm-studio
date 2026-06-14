-- ============================================================================
-- CRM Studio — Onboarding: novos campos em fluxo_cards
-- ============================================================================
-- Adiciona cliente_id, data_limite e concluido em fluxo_cards.
-- empresa_id e RLS já foram aplicados pela migration 20260611180000_multitenant_foundation.sql
-- NÃO aplicar este script diretamente — será aplicado via `supabase db push` pelo CI.
-- ============================================================================

alter table public.fluxo_cards
  add column if not exists cliente_id  uuid references public.clientes(id) on delete set null,
  add column if not exists data_limite date,
  add column if not exists concluido   boolean not null default false;

-- Índice para queries por cliente
create index if not exists idx_fluxo_cards_cliente_id on public.fluxo_cards(cliente_id);
