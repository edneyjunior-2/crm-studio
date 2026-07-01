-- calendario_contatos.email tinha UNIQUE GLOBAL -> um contato com o mesmo e-mail
-- em outro tenant fazia o insert falhar (vazamento/quebra de isolamento).
-- Passa a ser único POR EMPRESA.
alter table public.calendario_contatos drop constraint if exists calendario_contatos_email_key;
create unique index if not exists calendario_contatos_empresa_email_key
  on public.calendario_contatos (empresa_id, email);

notify pgrst, 'reload schema';
