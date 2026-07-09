-- Permite vincular um processo jurídico a mais de um cliente.
--
-- processos_juridicos.cliente_id continua sendo o cliente PRINCIPAL (escrito
-- exatamente como hoje). Esta tabela guarda só os clientes ADICIONAIS (2º em
-- diante) — por isso não precisa de backfill: nenhum processo hoje tem mais
-- de 1 cliente, então cliente_id já representa 100% do conjunto existente.
create table if not exists public.processos_clientes (
  id          uuid default gen_random_uuid() primary key,
  processo_id uuid not null references public.processos_juridicos(id) on delete cascade,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  created_at  timestamptz default now() not null,
  unique (processo_id, cliente_id)
);

alter table public.processos_clientes enable row level security;

drop trigger if exists trg_set_empresa on public.processos_clientes;
create trigger trg_set_empresa
  before insert on public.processos_clientes
  for each row execute function public.set_empresa_id();

drop policy if exists tenant_isolation on public.processos_clientes;
create policy tenant_isolation on public.processos_clientes
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- RESTRICTIVE sozinha nega tudo (sem PERMISSIVE, não há "using(true)" implícito
-- pra combinar com AND) — mesmo bug já corrigido em processos_juridicos/
-- movimentacoes_processo (20260619010000_fix_processos_rls.sql) e no mesmo
-- molde de processos_prazos (20260624000003_processos_prazos.sql). Vínculo de
-- cliente segue a mesma regra de acesso do campo cliente_id em
-- processos_juridicos: qualquer autenticado do tenant lê/vincula/desvincula —
-- quem pode editar o processo em si já é decidido pela RLS de UPDATE de
-- processos_juridicos, checada antes de tocar nesta tabela (ver atualizarProcesso).
drop policy if exists select_auth on public.processos_clientes;
create policy select_auth on public.processos_clientes
  for select to authenticated using (true);

drop policy if exists insert_auth on public.processos_clientes;
create policy insert_auth on public.processos_clientes
  for insert to authenticated with check (true);

drop policy if exists delete_auth on public.processos_clientes;
create policy delete_auth on public.processos_clientes
  for delete to authenticated using (true);

create index if not exists idx_processos_clientes_processo on public.processos_clientes(processo_id);
create index if not exists idx_processos_clientes_cliente on public.processos_clientes(cliente_id);

notify pgrst, 'reload schema';
