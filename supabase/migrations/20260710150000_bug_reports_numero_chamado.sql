-- Numeração sequencial dos "chamados" (bug_reports) — pedido do Edney pra
-- referenciar cada report mais fácil (ex.: "chamado #003") em vez do UUID.
-- Backfill cronológico: o primeiro reportado (created_at mais antigo) vira 1.
alter table public.bug_reports add column if not exists numero integer;

with ordenados as (
  select id, row_number() over (order by created_at asc) as rn
  from public.bug_reports
)
update public.bug_reports b
set numero = o.rn
from ordenados o
where b.id = o.id;

alter table public.bug_reports alter column numero set not null;
alter table public.bug_reports add constraint bug_reports_numero_key unique (numero);

-- Sequence começa depois do maior número já usado no backfill, pra numerar
-- os próximos chamados automaticamente (DEFAULT), sem trava de race condition.
-- Tabela vazia (banco novo, reconstruído do zero a partir das migrations —
-- ver 20260627120000_bug_reports_tabela_base.sql) é um caso real: setval
-- não aceita 0 (sequence começa em 1), então usa a forma de 3 argumentos
-- com is_called=false pra o primeiro chamado nascer #1 em vez de estourar erro.
create sequence if not exists public.bug_reports_numero_seq;
with maximo as (
  select max(numero) as valor from public.bug_reports
)
select setval(
  'public.bug_reports_numero_seq',
  coalesce((select valor from maximo), 1),
  (select valor from maximo) is not null
);
alter table public.bug_reports alter column numero set default nextval('public.bug_reports_numero_seq');
alter sequence public.bug_reports_numero_seq owned by public.bug_reports.numero;

notify pgrst, 'reload schema';
