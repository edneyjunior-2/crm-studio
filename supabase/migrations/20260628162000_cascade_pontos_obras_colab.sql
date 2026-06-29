-- LGPD: pontos e obras_colaboradores tinham FK empresa_id com NO ACTION (não cascade),
-- fora da migration de purga (20260619210000_purge_cascade). Ao deletar uma empresa
-- na purga, esses dados não eram descartados de forma confiável. Troca p/ ON DELETE CASCADE.

alter table public.pontos drop constraint if exists pontos_empresa_id_fkey;
alter table public.pontos add constraint pontos_empresa_id_fkey
  foreign key (empresa_id) references public.empresas(id) on delete cascade;

alter table public.obras_colaboradores drop constraint if exists obras_colaboradores_empresa_id_fkey;
alter table public.obras_colaboradores add constraint obras_colaboradores_empresa_id_fkey
  foreign key (empresa_id) references public.empresas(id) on delete cascade;

notify pgrst, 'reload schema';
