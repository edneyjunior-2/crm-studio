-- ============================================================================
-- CRM Studio — Tabela api_keys (integração SDR e outros serviços externos)
-- ============================================================================

create table if not exists public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  key_hash    text not null unique,   -- sha256 do token real; nunca armazenar o plaintext
  label       text,
  created_at  timestamptz not null default now()
);

alter table public.api_keys enable row level security;
-- Sem policy para authenticated → somente service role tem acesso (segurança total)

create index if not exists idx_api_keys_empresa    on public.api_keys(empresa_id);
create index if not exists idx_api_keys_key_hash   on public.api_keys(key_hash);

notify pgrst, 'reload schema';
