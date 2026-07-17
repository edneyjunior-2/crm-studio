-- Quem clicou em "Enviar para assinatura" (ação enviarParaAssinatura) — hoje só
-- existe `created_by`, que é quem GEROU/salvou o PDF, uma pessoa diferente na
-- prática. FK aponta pra public.profiles(id) (não auth.users) porque o embed
-- PostgREST `profiles!enviado_por(full_name)` só funciona com esse alvo — ver
-- convenção já usada em negocios.responsavel_id / processos_juridicos.advogado_id.

alter table public.contratos_gerados
  add column if not exists enviado_por uuid references public.profiles(id) on delete set null;

comment on column public.contratos_gerados.enviado_por is
  'Quem clicou em "Enviar para assinatura" (ação em enviarParaAssinatura) — distinto de created_by, que é quem gerou/salvou o PDF.';

notify pgrst, 'reload schema';
