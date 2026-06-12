-- Migration 019: Google Calendar integration
-- Adiciona tokens OAuth do Google ao perfil do usuário
-- e campos de evento no calendário às atividades

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_access_token text,
  ADD COLUMN IF NOT EXISTS google_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_token_expiry timestamptz;

-- Armazena referência ao evento criado no Google Calendar
ALTER TABLE atividades
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_event_url text;

NOTIFY pgrst, 'reload schema';
