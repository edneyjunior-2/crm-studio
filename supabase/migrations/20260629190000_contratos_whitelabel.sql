-- Gerador de contratos white-label: contratos gerados (salvar + re-baixar) +
-- buckets privados (modelos por tenant e PDFs gerados).
-- Os campos do modelo por empresa (contrato_template_path, contrato_aprovado)
-- vivem em empresas.config (jsonb) — sem DDL.

create table if not exists public.contratos_gerados (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  parceiro_nome text,
  parceiro_doc  text,
  tipo          text check (tipo in ('PJ', 'PF')),
  storage_path  text not null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_contratos_gerados_empresa
  on public.contratos_gerados (empresa_id, created_at desc);

alter table public.contratos_gerados enable row level security;

-- Isola por empresa. current_empresa_id() honra empresa_ativa_id p/ platform admin.
create policy "contratos_gerados_select" on public.contratos_gerados
  for select using (empresa_id = current_empresa_id());
create policy "contratos_gerados_insert" on public.contratos_gerados
  for insert with check (empresa_id = current_empresa_id());
create policy "contratos_gerados_delete" on public.contratos_gerados
  for delete using (empresa_id = current_empresa_id());

-- Buckets privados (acesso via admin client server-side + signed URLs)
insert into storage.buckets (id, name, public)
  values ('contrato-templates', 'contrato-templates', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('contratos-gerados', 'contratos-gerados', false)
  on conflict (id) do nothing;

notify pgrst, 'reload schema';
