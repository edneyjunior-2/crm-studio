create table if not exists calendario_contatos (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  nome text,
  created_at timestamptz default now()
);

alter table calendario_contatos enable row level security;

create policy "autenticados podem ler contatos"
  on calendario_contatos for select
  to authenticated
  using (true);

create policy "autenticados podem inserir contatos"
  on calendario_contatos for insert
  to authenticated
  with check (true);

NOTIFY pgrst, 'reload schema';
