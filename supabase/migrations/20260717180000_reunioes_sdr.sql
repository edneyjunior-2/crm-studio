-- Spec: .claude/specs/sdr-agendamento-real.md
-- Agendamento real da Leila (Google Calendar) com confirmação das sócias.
--
-- reunioes_sdr: fonte de verdade do agendamento pendente/confirmado, criado
-- por POST /api/leads/reuniao (endpoint autenticado por API key, mesmo padrão
-- de /api/leads/ingest) e consumido pelas server actions do CRM
-- (listarReunioesPendentes/confirmarReuniao/recusarReuniao).
--
-- reunioes_sdr_travas: trava anti-corrida (AC3). Um slot de agenda é sempre
-- alinhado à grade fixa (seg-sex, hora cheia, 1h de duração) — por isso duas
-- reuniões só podem colidir de verdade quando (sócia, data_inicio) coincidem
-- EXATAMENTE. Antes de criar o evento no Google, o endpoint tenta inserir uma
-- linha por sócia envolvida NUM ÚNICO insert multi-linha — se qualquer uma
-- colidir com uma trava já existente (UNIQUE(socia_id, data_inicio)), o
-- insert inteiro falha (23505) e a requisição perdedora da corrida recebe
-- "horário não está mais disponível" em vez de criar um segundo evento no
-- mesmo horário. Ao recusar uma reunião, as travas dela são apagadas (libera
-- o horário para uma nova oferta).
--
-- RLS: mesmo padrão de conversations/messages do app-sdr (0002_chat.sql) —
-- habilitada SEM nenhuma policy permissiva. Só o service_role (admin client,
-- usado pelos 2 endpoints novos e pelas server actions) acessa estas tabelas;
-- nega qualquer acesso via client anon/authenticated.

create table if not exists public.reunioes_sdr (
  id               uuid        primary key default gen_random_uuid(),
  empresa_id       uuid        not null references public.empresas(id) on delete cascade,
  negocio_id       uuid        references public.negocios(id) on delete set null,
  conversation_id  uuid        not null references public.conversations(id) on delete cascade,
  tipo             text        not null check (tipo in ('video', 'presencial')),
  data_inicio      timestamptz not null,
  data_fim         timestamptz not null,
  lead_nome        text        not null,
  lead_telefone    text        not null,
  lead_email       text,
  -- profile ids que podem confirmar/recusar (1 sócia = individual, 2 = conjunta)
  confirmantes     uuid[]      not null default '{}',
  status           text        not null default 'pendente'
                     check (status in ('pendente', 'confirmada', 'recusada', 'cancelada')),
  confirmado_por   uuid        references public.profiles(id) on delete set null,
  confirmado_em    timestamptz,
  google_event_id  text        not null,
  google_calendar_id text      not null default 'primary',
  meet_link        text,
  created_at       timestamptz not null default now(),

  constraint reunioes_sdr_periodo_valido check (data_fim > data_inicio)
);

comment on table public.reunioes_sdr is
  'Agendamento real da Leila (SDR) — evento já existe no Google Calendar, mas fica pendente até uma sócia confirmar no CRM.';
comment on column public.reunioes_sdr.confirmantes is
  'profiles.id que podem confirmar/recusar esta reunião — 1 (individual) ou 2 (conjunta).';
comment on column public.reunioes_sdr.confirmado_por is
  'Quem resolveu a pendência (confirmou OU recusou) — reaproveitado nos dois fluxos para não crescer o schema.';

create index if not exists idx_reunioes_sdr_empresa on public.reunioes_sdr(empresa_id);
create index if not exists idx_reunioes_sdr_conversation on public.reunioes_sdr(conversation_id);
create index if not exists idx_reunioes_sdr_confirmantes on public.reunioes_sdr using gin(confirmantes);
create index if not exists idx_reunioes_sdr_status_periodo on public.reunioes_sdr(status, data_inicio);

alter table public.reunioes_sdr enable row level security;

create table if not exists public.reunioes_sdr_travas (
  id           uuid        primary key default gen_random_uuid(),
  empresa_id   uuid        not null references public.empresas(id) on delete cascade,
  socia_id     uuid        not null references public.profiles(id) on delete cascade,
  data_inicio  timestamptz not null,
  reuniao_id   uuid        references public.reunioes_sdr(id) on delete cascade,
  created_at   timestamptz not null default now(),

  constraint reunioes_sdr_travas_slot_unico unique (socia_id, data_inicio)
);

comment on table public.reunioes_sdr_travas is
  'Trava anti-corrida do agendamento SDR (AC3) — ver comentário no topo do arquivo de migration.';

create index if not exists idx_reunioes_sdr_travas_empresa on public.reunioes_sdr_travas(empresa_id);
create index if not exists idx_reunioes_sdr_travas_reuniao on public.reunioes_sdr_travas(reuniao_id);

alter table public.reunioes_sdr_travas enable row level security;

notify pgrst, 'reload schema';
