-- Rastreia eventos criados via CRM (para saber qual calendarId e quem é o organizador)
create table if not exists calendario_eventos (
  id uuid default gen_random_uuid() primary key,
  event_id text not null unique,
  calendar_id text not null,
  organizer_email text not null,
  organizer_user_id uuid references auth.users(id) on delete set null,
  titulo text not null,
  created_at timestamptz default now() not null
);
alter table calendario_eventos enable row level security;
-- Todos os membros autenticados podem ler (para saberem quem é o criador)
create policy "calendario_eventos_select" on calendario_eventos for select to authenticated using (true);
-- Qualquer autenticado pode inserir (createEvento action usa service role também, mas por segurança)
create policy "calendario_eventos_insert" on calendario_eventos for insert to authenticated with check (true);
-- Só o organizador pode atualizar (via service role na prática)
create policy "calendario_eventos_update" on calendario_eventos for update to authenticated using (organizer_user_id = auth.uid());

-- Notificações de edições feitas por outros usuários
create table if not exists calendario_notificacoes (
  id uuid default gen_random_uuid() primary key,
  event_id text not null,
  event_title text not null,
  changed_by_user_id uuid not null references auth.users(id) on delete cascade,
  changed_by_nome text not null,
  notified_user_id uuid not null references auth.users(id) on delete cascade,
  campo text not null,  -- 'titulo' | 'horario' | 'descricao' | 'participantes'
  valor_anterior text,
  valor_novo text,
  seen boolean default false not null,
  created_at timestamptz default now() not null
);
alter table calendario_notificacoes enable row level security;
create policy "notificacoes_select_proprio" on calendario_notificacoes for select using (notified_user_id = auth.uid());
create policy "notificacoes_insert_auth" on calendario_notificacoes for insert to authenticated with check (true);
create policy "notificacoes_update_proprio" on calendario_notificacoes for update using (notified_user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
