-- Etapas do funil CUSTOMIZÁVEIS por empresa (tenant).
-- Antes: negocios.estagio era um enum FIXO (6 valores) — não servia para verticais
-- com funil próprio (recuperação tributária, advocacia, engenharia).
-- Agora: cada empresa tem suas etapas (nome/ordem/quantidade livres). O negocio.estagio
-- continua um SLUG de texto que referencia pipeline_estagios.slug (estável p/ não migrar
-- dados ao renomear). O campo `tipo` (aberto|ganho|perdido) é a ÂNCORA SEMÂNTICA: as
-- automações (fechar ganho -> financeiro; perdido -> motivo/histórico) dependem dele,
-- não do nome — então o cliente pode renomear/reordenar à vontade sem quebrar nada.

create table if not exists public.pipeline_estagios (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  slug        text not null,
  nome        text not null,
  ordem       int  not null default 0,
  tipo        text not null default 'aberto' check (tipo in ('aberto', 'ganho', 'perdido')),
  cor         text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (empresa_id, slug)
);

create index if not exists idx_pipeline_estagios_empresa on public.pipeline_estagios (empresa_id, ordem);

alter table public.pipeline_estagios enable row level security;
create policy "pipeline_estagios_all" on public.pipeline_estagios
  for all
  using (empresa_id = current_empresa_id())
  with check (empresa_id = current_empresa_id());

-- Seed: as 6 etapas atuais p/ TODA empresa (slugs idênticos aos de hoje => negócios
-- existentes continuam válidos sem nenhuma alteração de dados).
insert into public.pipeline_estagios (empresa_id, slug, nome, ordem, tipo)
select e.id, v.slug, v.nome, v.ordem, v.tipo
from public.empresas e
cross join (values
  ('prospeccao',      'Prospecção',   1, 'aberto'),
  ('qualificacao',    'Qualificação', 2, 'aberto'),
  ('proposta',        'Proposta',     3, 'aberto'),
  ('negociacao',      'Negociação',   4, 'aberto'),
  ('fechado_ganho',   'Ganho',        5, 'ganho'),
  ('fechado_perdido', 'Perdido',      6, 'perdido')
) as v(slug, nome, ordem, tipo)
on conflict (empresa_id, slug) do nothing;

-- Solta o enum fixo: agora os slugs são livres por tenant.
alter table public.negocios drop constraint if exists negocios_estagio_check;

notify pgrst, 'reload schema';
