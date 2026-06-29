-- Resumo agregado do catálogo de preços (insumos x composições por fonte/uf/mês).
-- Corrige o bug da tela /admin/sinapi, que contava no cliente a partir de um SELECT
-- limitado pelo cap de 1000 linhas do PostgREST (mostrava "0 insumos / 1.000 comp").
-- A agregação roda no banco e a view tem poucas linhas (1 por fonte/uf/mês).

create or replace view public.precos_referencia_resumo as
select
  fonte,
  uf,
  data_ref,
  count(*) filter (where tipo = 'insumo')     as insumos,
  count(*) filter (where tipo = 'composicao') as composicoes,
  count(*)                                     as total
from public.precos_referencia
group by fonte, uf, data_ref;

notify pgrst, 'reload schema';
