-- Medição vira BOLETIM FÍSICO-FINANCEIRO: vincula ao orçamento e mede o %
-- executado por ETAPA. Antes era uma lista flat (número, %, valor) desconectada.
-- O valor medido por etapa = % acumulado × valor orçado da etapa; o total da
-- medição e a curva S (acumulado por medição) derivam disso.

alter table public.obras_medicoes
  add column if not exists orcamento_id uuid references public.orcamentos(id) on delete set null;

create table if not exists public.medicao_etapas (
  id          uuid primary key default gen_random_uuid(),
  medicao_id  uuid not null references public.obras_medicoes(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  etapa       text not null,
  -- % ACUMULADO executado da etapa até esta medição (0–100). O incremento desta
  -- medição = este % menos o % da medição anterior da mesma etapa.
  percentual  numeric(5,2) not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_medicao_etapas_medicao on public.medicao_etapas (medicao_id);
create index if not exists idx_medicao_etapas_empresa on public.medicao_etapas (empresa_id);

alter table public.medicao_etapas enable row level security;
create policy "medicao_etapas_all" on public.medicao_etapas
  for all
  using (empresa_id = current_empresa_id())
  with check (empresa_id = current_empresa_id());

notify pgrst, 'reload schema';
