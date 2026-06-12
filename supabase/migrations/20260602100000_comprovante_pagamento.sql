-- Adiciona coluna de URL do comprovante na tabela de contas a pagar
alter table contas_pagar add column if not exists comprovante_url text;

-- Bucket público para comprovantes de pagamento
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovantes',
  'comprovantes',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- RLS: qualquer autenticado pode fazer upload
create policy "comprovantes_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comprovantes');

-- RLS: qualquer autenticado pode ler
create policy "comprovantes_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprovantes');

-- RLS: quem fez upload pode deletar
create policy "comprovantes_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'comprovantes' and auth.uid()::text = (storage.foldername(name))[1]);

NOTIFY pgrst, 'reload schema';
