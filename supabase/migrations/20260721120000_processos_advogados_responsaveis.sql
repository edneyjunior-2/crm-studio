-- Feature: suporte a mais de 1 advogado responsável por processo (capacidade global do
-- módulo Advocacia). `processos_juridicos.advogado_id` continua sendo o responsável
-- PRINCIPAL (nenhuma mudança nele) — esta tabela é aditiva, só para responsáveis
-- adicionais. Hoje o produto usa no máximo 1 linha extra por processo (2º responsável),
-- mas o modelo já suporta N sem re-trabalho futuro.

create table if not exists public.processos_advogados (
  id          uuid default gen_random_uuid() primary key,
  processo_id uuid not null references public.processos_juridicos(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  advogado_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (processo_id, advogado_id)
);

alter table public.processos_advogados enable row level security;

drop trigger if exists trg_set_empresa on public.processos_advogados;
create trigger trg_set_empresa
  before insert on public.processos_advogados
  for each row execute function public.set_empresa_id();

-- RLS: isolamento por tenant (RESTRICTIVE), mesmo padrão de processos_juridicos/publicacoes_processo
drop policy if exists "tenant_isolation" on public.processos_advogados;
create policy tenant_isolation on public.processos_advogados
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

drop policy if exists "processos_advogados: todos leem" on public.processos_advogados;
create policy "processos_advogados: todos leem"
  on public.processos_advogados
  as permissive for select
  using (auth.uid() is not null);

-- Escrita liberada pra qualquer autenticado do tenant (mesmo modelo de processos_juridicos:
-- a restrição de "só admin/socio reatribui" já é feita na camada de aplicação, não na RLS).
drop policy if exists "processos_advogados: todos gerenciam" on public.processos_advogados;
create policy "processos_advogados: todos gerenciam"
  on public.processos_advogados
  as permissive for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists idx_processos_advogados_processo
  on public.processos_advogados (processo_id);

create index if not exists idx_processos_advogados_advogado
  on public.processos_advogados (advogado_id);

notify pgrst, 'reload schema';
