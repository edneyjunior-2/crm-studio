-- ============================================================================
-- CRM Studio — M2/Etapa 3: Tabelas transacionais de billing (Asaas)
-- ============================================================================
-- Depende de: 20260611180000_multitenant_foundation.sql (empresas, current_empresa_id)
--             20260617071401_billing_catalogo_gating.sql (planos, addons)
-- ============================================================================

-- 1) Coluna de billing em empresas --------------------------------------------

alter table public.empresas
  add column if not exists asaas_customer_id text unique;

-- 2) Tabela assinaturas (fonte da verdade do estado de billing) ---------------

create table if not exists public.assinaturas (
  id                      uuid primary key default gen_random_uuid(),
  empresa_id              uuid not null references public.empresas(id) on delete cascade,
  plano                   text not null check (plano in ('free','starter','pro','business')),
  asaas_subscription_id   text unique,                 -- sub_... (null para Free)
  status                  text not null default 'trial'
                            check (status in ('trial','ativo','pendente','atrasado','suspenso','cancelado')),
  billing_type            text,                        -- PIX | BOLETO | CREDIT_CARD | UNDEFINED
  cycle                   text not null default 'MONTHLY',
  value                   numeric(10,2) not null default 0,
  current_period_end      timestamptz,
  trial_ends_at           timestamptz,
  dunning_since           timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.assinaturas enable row level security;

-- Apenas admin da própria empresa lê/edita; escrita transacional pelo service role
drop policy if exists assinaturas_select on public.assinaturas;
create policy assinaturas_select on public.assinaturas as restrictive for select
  to authenticated
  using (empresa_id = public.current_empresa_id());

drop policy if exists assinaturas_update on public.assinaturas;
create policy assinaturas_update on public.assinaturas as restrictive for update
  to authenticated
  using (empresa_id = public.current_empresa_id());

create index if not exists idx_assinaturas_empresa    on public.assinaturas(empresa_id);
create index if not exists idx_assinaturas_asaas_sub  on public.assinaturas(asaas_subscription_id);

-- 3) Tabela faturas (espelho das cobranças Asaas) -----------------------------

create table if not exists public.faturas (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  assinatura_id       uuid references public.assinaturas(id),
  asaas_payment_id    text not null unique,            -- pay_...
  status              text not null default 'pendente'
                        check (status in ('pendente','confirmada','recebida','vencida',
                                          'estornada','chargeback','removida')),
  valor               numeric(10,2) not null default 0,
  vencimento          date,
  pago_em             timestamptz,
  billing_type        text,
  invoice_url         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.faturas enable row level security;

drop policy if exists faturas_select on public.faturas;
create policy faturas_select on public.faturas as restrictive for select
  to authenticated
  using (empresa_id = public.current_empresa_id());

drop policy if exists faturas_update on public.faturas;
create policy faturas_update on public.faturas as restrictive for update
  to authenticated
  using (empresa_id = public.current_empresa_id());

create index if not exists idx_faturas_empresa       on public.faturas(empresa_id);
create index if not exists idx_faturas_assinatura    on public.faturas(assinatura_id);
create index if not exists idx_faturas_payment_id    on public.faturas(asaas_payment_id);

-- 4) Tabela eventos_webhook (plataforma — sem acesso de usuário comum) --------

create table if not exists public.eventos_webhook (
  id                uuid primary key default gen_random_uuid(),
  asaas_event_id    text not null unique,              -- evt_... chave de idempotência
  event             text not null,
  asaas_payment_id  text,
  empresa_id        uuid references public.empresas(id),
  payload           jsonb not null default '{}'::jsonb,
  processed         boolean not null default false,
  processed_at      timestamptz,
  error             text,
  received_at       timestamptz not null default now()
);

alter table public.eventos_webhook enable row level security;
-- Nenhuma policy para authenticated → acesso negado por padrão (only service role)

create index if not exists idx_eventos_webhook_event_id   on public.eventos_webhook(asaas_event_id);
create index if not exists idx_eventos_webhook_payment_id on public.eventos_webhook(asaas_payment_id);
create index if not exists idx_eventos_webhook_processed  on public.eventos_webhook(processed) where not processed;

notify pgrst, 'reload schema';
