-- ============================================================================
-- Vigias dos crons de sincronização — registro de execução (observabilidade)
-- ============================================================================
-- Spec: .claude/specs/vigias-cron-sincronizacao.md
--
-- Tabela operacional da PLATAFORMA (não é dado de tenant): cada execução dos
-- crons de sincronização de processos (atualizar-processos/DataJud e
-- publicacoes-djen/DJEN) grava uma linha aqui, sucesso ou falha. O vigia
-- diário (watchdog-sincronizacao) lê a última linha de cada slug para
-- detectar cron que não rodou ou que rodou com falha.
-- ============================================================================

-- IF NOT EXISTS em tabela/índice (padrão do projeto — migrations às vezes são
-- reaplicadas à mão via SQL Editor; ver GOTCHA de colisão de prefixo).
create table if not exists public.cron_execucoes (
  id           uuid primary key default gen_random_uuid(),
  cron_slug    text not null,              -- 'atualizar-processos' | 'publicacoes-djen'
  executado_em timestamptz not null default now(),
  ok           boolean not null,           -- false só quando um erro FATAL abortou o run inteiro
  resumo       jsonb not null default '{}'
);
create index if not exists cron_execucoes_slug_idx on public.cron_execucoes (cron_slug, executado_em desc);

-- Operacional da plataforma, não dado de tenant — RLS ligado, ZERO policy pra
-- `authenticated` (mesmo padrão default-deny de `eventos_webhook`). Só
-- service_role escreve/lê. enable row level security é idempotente por si só.
alter table public.cron_execucoes enable row level security;

notify pgrst, 'reload schema';
