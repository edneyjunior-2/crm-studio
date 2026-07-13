-- Sincronização incremental Google Calendar → CRM (polling via cron).
-- google_calendar_sync_token: nextSyncToken da API do Google, pra buscar só o
-- que mudou desde a última passada do cron (sem token = full sync inicial).
-- google_calendar_last_synced_at: exibido na UI ("sincronizado há X min").
alter table public.profiles
  add column if not exists google_calendar_sync_token text,
  add column if not exists google_calendar_last_synced_at timestamptz;

-- origem distingue evento criado pelo próprio CRM (gerenciado pelas actions
-- existentes) de evento importado do Google Calendar do usuário (gerenciado
-- só pelo poller). O poller nunca mexe em linhas 'crm'.
alter table public.calendario_eventos
  add column if not exists origem text not null default 'crm';

alter table public.calendario_eventos
  drop constraint if exists calendario_eventos_origem_check;
alter table public.calendario_eventos
  add constraint calendario_eventos_origem_check check (origem in ('crm', 'google_import'));

notify pgrst, 'reload schema';
