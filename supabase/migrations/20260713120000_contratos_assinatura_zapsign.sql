-- Assinatura eletrônica (ZapSign) no gerador de contratos white-label: adiciona
-- controle de status/assinatura em contratos_gerados e a policy de UPDATE que
-- faltava (até aqui só select/insert/delete). Ver spec
-- .claude/specs/contratos-assinatura-zapsign.md.

alter table public.contratos_gerados
  add column status text not null default 'rascunho'
    check (status in ('rascunho', 'enviado', 'assinado', 'recusado')),
  add column zapsign_doc_token text unique,
  add column zapsign_nivel text check (zapsign_nivel in ('avancada', 'qualificada')),
  add column link_assinatura text,
  add column signed_at timestamptz,
  add column signed_storage_path text;

-- Isola por empresa, mesmo padrão das policies existentes (current_empresa_id()
-- honra empresa_ativa_id p/ platform admin). Replica o hardening "parceiro não
-- acessa contratos_gerados" da migration 20260707150000 (CRÍTICO) — sem essa
-- exclusão, um usuário com role 'parceiro' do mesmo tenant conseguiria dar
-- PATCH direto via PostgREST em status/link_assinatura de qualquer contrato.
create policy "contratos_gerados_update" on public.contratos_gerados
  for update
  using (empresa_id = current_empresa_id() and public.get_my_role() <> 'parceiro')
  with check (empresa_id = current_empresa_id() and public.get_my_role() <> 'parceiro');

notify pgrst, 'reload schema';
