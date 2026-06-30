-- Negócio passa a ter (a) INDICADOR próprio — parceiro externo OU membro do time,
-- espelhando o cliente — e (b) LINHA DE PRODUTOS: um negócio pode conter vários
-- produtos (solução + valor), e o valor_estimado do negócio é a soma deles.
-- Ex.: recuperação tributária = Previdenciária (R$X) + Fazendária (R$Y).

alter table public.negocios
  add column if not exists parceiro_id  uuid references public.parceiros(id) on delete set null,
  add column if not exists indicado_por uuid references public.profiles(id) on delete set null;

create table if not exists public.negocio_produtos (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  solucao_id  uuid references public.solucoes(id) on delete set null,
  descricao   text,
  valor       numeric(15,2) not null default 0,
  ordem       int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_negocio_produtos_negocio on public.negocio_produtos (negocio_id);
create index if not exists idx_negocio_produtos_empresa on public.negocio_produtos (empresa_id);

alter table public.negocio_produtos enable row level security;
create policy "negocio_produtos_all" on public.negocio_produtos
  for all
  using (empresa_id = current_empresa_id())
  with check (empresa_id = current_empresa_id());

notify pgrst, 'reload schema';
