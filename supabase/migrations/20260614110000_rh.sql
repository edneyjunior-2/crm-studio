-- ============================================================================
-- CRM Studio — Módulo RH (M7)
-- ============================================================================
-- Cria as tabelas colaboradores, ausencias e lancamentos_folha.
-- Reutiliza current_empresa_id() e set_empresa_id() da fundação multi-tenant
-- (20260611180000_multitenant_foundation.sql).
-- RLS RESTRICTIVE por empresa_id em todas as tabelas. Nenhuma tabela sem RLS.
-- ============================================================================

-- 1) colaboradores ------------------------------------------------------------
create table if not exists public.colaboradores (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id),
  nome             text not null,
  cpf              text,
  cargo            text,
  departamento     text,
  email            text,
  telefone         text,
  data_admissao    date,
  data_desligamento date,
  status           text not null default 'ativo'
                     check (status in ('ativo', 'afastado', 'desligado')),
  tipo_contrato    text
                     check (tipo_contrato in ('clt', 'pj', 'estagio', 'outro')),
  salario          numeric(14, 2),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

alter table public.colaboradores enable row level security;

create index if not exists idx_colaboradores_empresa on public.colaboradores(empresa_id);
create index if not exists idx_colaboradores_status   on public.colaboradores(status);

drop trigger if exists trg_set_empresa on public.colaboradores;
create trigger trg_set_empresa
  before insert on public.colaboradores
  for each row execute function public.set_empresa_id();

drop policy if exists tenant_isolation on public.colaboradores;
create policy tenant_isolation on public.colaboradores
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- 2) ausencias ----------------------------------------------------------------
create table if not exists public.ausencias (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  tipo            text not null
                    check (tipo in ('ferias', 'atestado', 'falta', 'licenca')),
  data_inicio     date not null,
  data_fim        date,
  observacao      text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

alter table public.ausencias enable row level security;

create index if not exists idx_ausencias_empresa       on public.ausencias(empresa_id);
create index if not exists idx_ausencias_colaborador   on public.ausencias(colaborador_id);

drop trigger if exists trg_set_empresa on public.ausencias;
create trigger trg_set_empresa
  before insert on public.ausencias
  for each row execute function public.set_empresa_id();

drop policy if exists tenant_isolation on public.ausencias;
create policy tenant_isolation on public.ausencias
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- 3) lancamentos_folha --------------------------------------------------------
create table if not exists public.lancamentos_folha (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  competencia     text not null,  -- formato 'YYYY-MM'
  salario_base    numeric(14, 2) not null default 0,
  beneficios      numeric(14, 2) default 0,
  descontos       numeric(14, 2) default 0,
  total           numeric(14, 2),
  status          text not null default 'aberto'
                    check (status in ('aberto', 'pago')),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

alter table public.lancamentos_folha enable row level security;

create index if not exists idx_lancamentos_folha_empresa      on public.lancamentos_folha(empresa_id);
create index if not exists idx_lancamentos_folha_colaborador  on public.lancamentos_folha(colaborador_id);
create index if not exists idx_lancamentos_folha_competencia  on public.lancamentos_folha(competencia);

drop trigger if exists trg_set_empresa on public.lancamentos_folha;
create trigger trg_set_empresa
  before insert on public.lancamentos_folha
  for each row execute function public.set_empresa_id();

drop policy if exists tenant_isolation on public.lancamentos_folha;
create policy tenant_isolation on public.lancamentos_folha
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- ============================================================================
-- Notifica o PostgREST para recarregar o schema
-- ============================================================================
notify pgrst, 'reload schema';
