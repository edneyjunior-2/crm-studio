-- ============================================================================
-- CRM Studio — Módulo Ponto Diário
-- ============================================================================
-- 1. Adiciona tipo_remuneracao à tabela colaboradores (diaria | mensal)
-- 2. Cria tabela pontos para registro diário de presença/ausência
-- ============================================================================

-- 1) tipo_remuneracao em colaboradores ----------------------------------------
alter table public.colaboradores
  add column if not exists tipo_remuneracao text not null default 'mensal'
  constraint colaboradores_tipo_remuneracao_check
    check (tipo_remuneracao in ('diaria', 'mensal'));

-- 2) pontos -------------------------------------------------------------------
create table if not exists public.pontos (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  data           date not null,
  presente       boolean not null default true,
  justificativa  text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  constraint pontos_colaborador_data_unique unique (colaborador_id, data)
);

alter table public.pontos enable row level security;

create index if not exists idx_pontos_empresa          on public.pontos(empresa_id);
create index if not exists idx_pontos_colaborador      on public.pontos(colaborador_id);
create index if not exists idx_pontos_data             on public.pontos(data);
create index if not exists idx_pontos_colaborador_data on public.pontos(colaborador_id, data);

drop trigger if exists trg_set_empresa on public.pontos;
create trigger trg_set_empresa
  before insert on public.pontos
  for each row execute function public.set_empresa_id();

drop policy if exists tenant_isolation on public.pontos;
create policy tenant_isolation on public.pontos
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

drop policy if exists select_all on public.pontos;
create policy select_all on public.pontos for select using (true);

drop policy if exists insert_auth on public.pontos;
create policy insert_auth on public.pontos for insert with check (true);

drop policy if exists update_auth on public.pontos;
create policy update_auth on public.pontos for update using (true) with check (true);

drop policy if exists delete_admin on public.pontos;
create policy delete_admin on public.pontos for delete using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.empresa_id = public.current_empresa_id()
  )
);

notify pgrst, 'reload schema';
