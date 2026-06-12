create table if not exists calendario_notas (
  event_id text primary key,
  event_title text not null,
  texto text not null default '',
  updated_by uuid not null references auth.users(id) on delete set null,
  updated_at timestamptz default now() not null
);
alter table calendario_notas enable row level security;
create policy "notas_select" on calendario_notas for select to authenticated using (true);
create policy "notas_insert" on calendario_notas for insert to authenticated with check (true);
create policy "notas_update" on calendario_notas for update to authenticated using (true);
NOTIFY pgrst, 'reload schema';
