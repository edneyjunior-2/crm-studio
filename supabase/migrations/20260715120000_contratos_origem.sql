-- Distingue contratos vindos do GERADOR (formulário + template) dos que foram
-- ENVIADOS por upload de um PDF pronto (fluxo de assinatura de documento
-- externo). Ambos vivem em contratos_gerados e reusam o mesmo histórico/webhook
-- de assinatura; origem só muda a UI (upload não tem "re-editar") e como o
-- reenvio monta a lista de signatários. Ver spec
-- .claude/specs/contratos-upload-assinatura.md.

alter table public.contratos_gerados
  add column origem text not null default 'gerador'
    check (origem in ('gerador', 'upload'));

notify pgrst, 'reload schema';
