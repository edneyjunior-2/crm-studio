-- Marca o canal de origem de um negócio (ex.: 'whatsapp' para leads
-- entregues pela Leila/SDR via /api/leads/ingest). Texto livre, sem enum
-- fechado — já pensando em outras origens no futuro (ex.: 'site', 'indicação').

alter table public.negocios
  add column if not exists origem text;

notify pgrst, 'reload schema';
