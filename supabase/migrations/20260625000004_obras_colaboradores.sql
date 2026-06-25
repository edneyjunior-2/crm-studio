-- ============================================================================
-- CRM Studio — obras_colaboradores + documento_path em pontos
-- ============================================================================
-- 1. obras_colaboradores: vínculo colaborador ↔ obra (centro de custo)
-- 2. documento_path: coluna para atestado/documento em pontos
-- ============================================================================

-- 1) obras_colaboradores -------------------------------------------------------
create table if not exists public.obras_colaboradores (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id),
  obra_id        uuid not null references public.obras(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  funcao         text,
  data_inicio    date,
  data_fim       date,
  ativo          boolean not null default true,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  constraint obras_colaboradores_unique unique (obra_id, colaborador_id)
);

alter table public.obras_colaboradores enable row level security;

create index if not exists idx_obras_col_empresa       on public.obras_colaboradores(empresa_id);
create index if not exists idx_obras_col_obra          on public.obras_colaboradores(obra_id);
create index if not exists idx_obras_col_colaborador   on public.obras_colaboradores(colaborador_id);
create index if not exists idx_obras_col_ativo         on public.obras_colaboradores(ativo);

drop trigger if exists trg_set_empresa on public.obras_colaboradores;
create trigger trg_set_empresa
  before insert on public.obras_colaboradores
  for each row execute function public.set_empresa_id();

drop policy if exists tenant_isolation on public.obras_colaboradores;
create policy tenant_isolation on public.obras_colaboradores
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

drop policy if exists select_all on public.obras_colaboradores;
create policy select_all on public.obras_colaboradores for select using (true);

drop policy if exists insert_auth on public.obras_colaboradores;
create policy insert_auth on public.obras_colaboradores for insert with check (true);

drop policy if exists update_auth on public.obras_colaboradores;
create policy update_auth on public.obras_colaboradores for update using (true) with check (true);

drop policy if exists delete_admin on public.obras_colaboradores;
create policy delete_admin on public.obras_colaboradores for delete using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and profiles.empresa_id = public.current_empresa_id()
  )
);

-- 2) documento_path em pontos -------------------------------------------------
alter table public.pontos
  add column if not exists documento_path text;

-- ============================================================================
-- Notifica o PostgREST
-- ============================================================================
notify pgrst, 'reload schema';
