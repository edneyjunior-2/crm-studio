-- Garante que TODA empresa (inclusive as criadas no futuro) tenha as 6 etapas
-- padrão do funil. Sem isso, um tenant novo cai no fallback 'padrao-N' do helper
-- (ids fake) e a tela de configuração de etapas não funciona.

create or replace function public.seed_pipeline_estagios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pipeline_estagios (empresa_id, slug, nome, ordem, tipo)
  values
    (new.id, 'prospeccao',      'Prospecção',   1, 'aberto'),
    (new.id, 'qualificacao',    'Qualificação', 2, 'aberto'),
    (new.id, 'proposta',        'Proposta',     3, 'aberto'),
    (new.id, 'negociacao',      'Negociação',   4, 'aberto'),
    (new.id, 'fechado_ganho',   'Ganho',        5, 'ganho'),
    (new.id, 'fechado_perdido', 'Perdido',      6, 'perdido')
  on conflict (empresa_id, slug) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_pipeline_estagios on public.empresas;
create trigger trg_seed_pipeline_estagios
  after insert on public.empresas
  for each row
  execute function public.seed_pipeline_estagios();

-- Backfill defensivo: qualquer empresa que ainda não tenha nenhuma etapa.
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
where not exists (select 1 from public.pipeline_estagios pe where pe.empresa_id = e.id)
on conflict (empresa_id, slug) do nothing;

notify pgrst, 'reload schema';
