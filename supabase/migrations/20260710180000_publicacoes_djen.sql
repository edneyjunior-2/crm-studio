-- Feature: captura automática de publicações do DJEN (Diário de Justiça Eletrônico Nacional)
-- OAB do advogado interno (necessário para consultar a API do DJEN por advogado)
alter table public.profiles
  add column if not exists oab_numero text,
  add column if not exists oab_uf text;

-- Publicações do DJEN vinculadas (ou não) a um processo
create table if not exists public.publicacoes_processo (
  id                    uuid default gen_random_uuid() primary key,
  processo_id           uuid references public.processos_juridicos(id) on delete cascade,
  empresa_id            uuid not null references public.empresas(id) on delete cascade,
  advogado_id           uuid references public.profiles(id) on delete set null,
  djen_id               bigint not null,
  data_disponibilizacao date not null,
  sigla_tribunal        text,
  tipo_comunicacao      text,
  texto                 text not null,
  numero_processo_cnj   text,
  link                  text,
  lido                  boolean not null default false,
  raw_data              jsonb,
  created_at            timestamptz default now(),
  unique (djen_id)
);

alter table public.publicacoes_processo enable row level security;

drop trigger if exists trg_set_empresa on public.publicacoes_processo;
create trigger trg_set_empresa
  before insert on public.publicacoes_processo
  for each row execute function public.set_empresa_id();

-- RLS: isolamento por tenant (RESTRICTIVE) + acesso de usuário autenticado (PERMISSIVE)
drop policy if exists "tenant_isolation" on public.publicacoes_processo;
create policy tenant_isolation on public.publicacoes_processo
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

drop policy if exists "publicacoes: todos leem" on public.publicacoes_processo;
create policy "publicacoes: todos leem"
  on public.publicacoes_processo
  as permissive for select
  using (auth.uid() is not null);

drop policy if exists "publicacoes: todos inserem" on public.publicacoes_processo;
create policy "publicacoes: todos inserem"
  on public.publicacoes_processo
  as permissive for insert
  with check (auth.uid() is not null);

drop policy if exists "publicacoes: todos atualizam" on public.publicacoes_processo;
create policy "publicacoes: todos atualizam"
  on public.publicacoes_processo
  as permissive for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "publicacoes: admin deleta" on public.publicacoes_processo;
create policy "publicacoes: admin deleta"
  on public.publicacoes_processo
  as permissive for delete
  using (public.get_my_role() = 'admin');

create index if not exists idx_publicacoes_processo_empresa
  on public.publicacoes_processo (empresa_id);

create index if not exists idx_publicacoes_processo_nao_lidas
  on public.publicacoes_processo (empresa_id, processo_id) where lido = false;

create index if not exists idx_publicacoes_data
  on public.publicacoes_processo (data_disponibilizacao desc);

create index if not exists idx_publicacoes_processo_id
  on public.publicacoes_processo (processo_id);
