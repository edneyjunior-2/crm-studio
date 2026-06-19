-- =============================================================================
-- Agenda multi-cliente do SDR (robô "Leila") + vínculo das conversas à empresa.
--
-- CRM e SDR compartilham o MESMO Supabase. Esta "agenda" deixa UM robô atender
-- VÁRIOS clientes: o webhook do WhatsApp identifica o cliente pelo phone_number_id
-- que a Meta envia e usa a config dele (CRM, persona/tom de voz).
--
-- ⚠️  NÃO aplicada ainda — aguarda aprovação (mexe em schema de produção).
-- =============================================================================

create table if not exists public.clientes_sdr (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  -- nº WhatsApp do cliente (ID do número na Meta) — identifica o tenant no webhook
  wa_phone_number_id  text not null unique,
  nome_escritorio     text,
  nome_assistente     text not null default 'Leila',
  tom_de_voz          text,        -- persona/system prompt, editável no Admin do CRM
  crm_api_key         text,        -- chave do CRM daquele cliente (handoff de lead → /api/leads/ingest)
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_clientes_sdr_empresa on public.clientes_sdr(empresa_id);

-- Vincula cada conversa do WhatsApp à empresa → inbox de Atendimento multi-tenant.
-- O webhook do SDR preenche empresa_id a partir do phone_number_id (via clientes_sdr).
alter table public.conversations
  add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;
create index if not exists idx_conversations_empresa on public.conversations(empresa_id);

notify pgrst, 'reload schema';
