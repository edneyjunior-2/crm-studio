-- Lembrete (follow-up manual) pode virar evento no Google Calendar do usuário —
-- guardamos o id/url do evento p/ rastrear e limpar (evitar evento órfão).
alter table public.followups
  add column if not exists google_event_id  text,
  add column if not exists google_event_url text;

notify pgrst, 'reload schema';
