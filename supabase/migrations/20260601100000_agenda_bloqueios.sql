create table if not exists agenda_bloqueios (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text,
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  created_at timestamptz default now() not null
);

alter table agenda_bloqueios enable row level security;

create policy "agenda_select_proprio" on agenda_bloqueios
  for select using (auth.uid() = user_id);

create policy "agenda_insert_proprio" on agenda_bloqueios
  for insert with check (auth.uid() = user_id);

create policy "agenda_delete_proprio" on agenda_bloqueios
  for delete using (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
