-- Vínculo explícito entre processo e o parceiro indicador (public.parceiros —
-- indicador comercial SEM login, distinto de processos_juridicos.parceiro_id
-- que já existe e aponta pra profiles/portal COM login — ver comentário em
-- src/app/(crm)/processos/[id]/page.tsx sobre os dois conceitos).
--
-- Mesmo padrão já usado em clientes.parceiro_id / negocios.parceiro_id:
-- FK 1:1, nullable, ON DELETE SET NULL.
alter table public.processos_juridicos
  add column if not exists indicador_parceiro_id uuid references public.parceiros(id) on delete set null;

create index if not exists idx_processos_indicador_parceiro
  on public.processos_juridicos(indicador_parceiro_id);

-- Backfill: converte os vínculos hoje só IMPLÍCITOS (indicacao texto-livre do
-- importador de Excel, casado via ILIKE contra parceiros.nome em tempo de
-- leitura — ver processos/[id]/page.tsx) em vínculo explícito. Mesma regra de
-- match (ILIKE, mesmo empresa_id) — não piora nem muda o comportamento hoje
-- observado, só o torna persistente. Idempotente: só preenche onde ainda null.
update public.processos_juridicos p
set indicador_parceiro_id = pc.parceiro_id
from (
  select distinct on (proc.id) proc.id as processo_id, par.id as parceiro_id
  from public.processos_juridicos proc
  join public.parceiros par
    on par.empresa_id = proc.empresa_id
   and par.nome ilike trim(proc.indicacao)
  where proc.indicacao is not null
    and trim(proc.indicacao) <> ''
    and proc.indicador_parceiro_id is null
  order by proc.id, par.nome
) pc
where p.id = pc.processo_id;

notify pgrst, 'reload schema';
