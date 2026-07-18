-- ============================================================================
-- Monitor da EJLABS — status agregado por sensor + log de falhas de e-mail
-- ============================================================================
-- Spec: .claude/specs/monitor-ejlabs-*.md
--
-- monitoramento_status: uma linha por sensor, escrita pelo cron
-- (/api/cron/monitor-ejlabs) a cada execução, lida pelo painel /admin e pelo
-- endpoint que o widget de menu-bar do Mac consulta. Não é recomputada a
-- cada leitura — o cron é quem faz o trabalho pesado.
--
-- monitoramento_falhas_email: hoje várias falhas de envio via Resend (Resend
-- fora do ar, endereço inválido) são engolidas com só um console.error. Esta
-- tabela vira o rastro consultável que o sensor de "e-mails falhos" lê.
-- ============================================================================

create table if not exists public.monitoramento_status (
  chave           text primary key,
  nome            text not null,
  area            text not null,
  status          text not null check (status in ('ok','alerta','critico')),
  detalhe         text not null default '',
  desde           timestamptz,              -- null quando status='ok'; carimbado na 1ª detecção do problema
  ultimo_alerta_em timestamptz,             -- último e-mail disparado pra este sensor (evita spam a cada rodada)
  atualizado_em   timestamptz not null default now()
);

create table if not exists public.monitoramento_falhas_email (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,              -- 'convite_primeiro_acesso' | 'reatribuicao_processo' | ...
  referencia_id uuid,                       -- empresa_id, processo_id etc, conforme o tipo
  destinatario  text,
  erro          text not null,
  criado_em     timestamptz not null default now()
);
create index if not exists monitoramento_falhas_email_criado_idx
  on public.monitoramento_falhas_email (criado_em desc);

-- Operacional da plataforma, não dado de tenant — mesmo padrão default-deny
-- de cron_execucoes/eventos_webhook: RLS ligado, zero policy pra
-- `authenticated`. Só service_role escreve/lê.
alter table public.monitoramento_status enable row level security;
alter table public.monitoramento_falhas_email enable row level security;

notify pgrst, 'reload schema';
