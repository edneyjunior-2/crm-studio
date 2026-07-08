-- Timbrado (cabeçalho institucional) por empresa — bucket privado.
-- O path vive em empresas.config.timbrado_path (jsonb) — sem DDL de coluna.
-- Acesso primário: admin client (service-role) + signed URL, igual ao gerador
-- de contratos (20260629190000). As policies abaixo são defesa-em-profundidade,
-- escopando o objeto pela pasta <empresa_id>/ ao tenant efetivo.

insert into storage.buckets (id, name, public)
  values ('timbrados', 'timbrados', false)
  on conflict (id) do nothing;

-- Isola por empresa: a 1ª pasta do path (<empresa_id>/) deve bater com o tenant
-- efetivo. current_empresa_id() honra empresa_ativa_id p/ platform admin (mesma
-- função usada nas policies de contratos_gerados).
create policy "timbrados_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'timbrados'
    and (storage.foldername(name))[1] = current_empresa_id()::text
  );

create policy "timbrados_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'timbrados'
    and (storage.foldername(name))[1] = current_empresa_id()::text
  );

create policy "timbrados_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'timbrados'
    and (storage.foldername(name))[1] = current_empresa_id()::text
  )
  with check (
    bucket_id = 'timbrados'
    and (storage.foldername(name))[1] = current_empresa_id()::text
  );

create policy "timbrados_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'timbrados'
    and (storage.foldername(name))[1] = current_empresa_id()::text
  );

notify pgrst, 'reload schema';
