-- Status individual de cada signatário (quem assinou, quem falta, e-mail que
-- recebeu o link) — hoje só existe o status agregado do documento inteiro
-- (rascunho/enviado/assinado/recusado), que não distingue "ninguém assinou"
-- de "faltam 2 de 3". Populado no envio (dispararAssinaturaZapSign, estado
-- inicial) e sincronizado a cada evento do webhook, que já manda o array
-- `signers[]` completo (nome, e-mail, status) em toda chamada — não precisa
-- de consulta extra à API. Ver spec .claude/specs/contratos-signatarios-status.md.

alter table public.contratos_gerados
  add column signatarios_zapsign jsonb;

notify pgrst, 'reload schema';
