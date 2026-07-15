-- Documentação retroativa da tabela public.bug_reports — ela foi criada
-- direto no SQL Editor do Supabase Studio (fora de qualquer migration),
-- igual já alertado em supabase/migrations/20260711000000_bug_reports_estatisticas.sql.
-- Sem isso, reconstruir o banco do zero (novo ambiente, disaster recovery,
-- staging) deixaria essa tabela inexistente, já que só existiam migrations
-- que a ALTERAM (índice, coluna numero, RPCs), nenhuma que a CRIA.
--
-- Schema abaixo reconstruído por introspecção direta em produção em
-- 2026-07-15 (information_schema.columns, pg_constraint, pg_indexes,
-- pg_policies) — não é suposição. Datada antes de 20260628161000 (a
-- primeira migration existente que referencia a tabela) para as migrations
-- seguintes (índice, coluna numero+sequence, RPCs) continuarem aplicando
-- em cima dela sem conflito.
--
-- Propositalmente NÃO inclui:
--   - a coluna `numero` + sequence + constraint `bug_reports_numero_key`
--     (criadas por 20260710150000_bug_reports_numero_chamado.sql)
--   - o índice `idx_bug_reports_empresa`
--     (criado por 20260628161000_indices_empresa_id_faltantes.sql)
-- Duplicar essas partes aqui colidiria com as migrations que já existem.
--
-- Idempotente: contra produção (tabela já existe) isto é um no-op; num
-- banco novo, cria a tabela do zero no formato correto.

create table if not exists public.bug_reports (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid references public.empresas(id) on delete set null,
  user_id        uuid references auth.users(id) on delete set null,
  user_name      text,
  user_role      text,
  url            text not null,
  descricao      text not null,
  screenshot_url text,
  contexto       jsonb default '{}'::jsonb,
  status         text default 'aberto'::text
                   constraint bug_reports_status_check
                   check (status = any (array['aberto'::text, 'em_analise'::text, 'resolvido'::text, 'ignorado'::text])),
  analise_claude jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.bug_reports enable row level security;

-- Usuário só enxerga/cria os próprios reports — quem muda status (incluindo
-- 'resolvido') é sempre o admin via service_role (bypassa RLS), nunca o
-- autor do report direto pela API.
drop policy if exists bug_reports_user_insert on public.bug_reports;
create policy bug_reports_user_insert on public.bug_reports
  for insert
  with check (user_id = auth.uid());

drop policy if exists bug_reports_user_select on public.bug_reports;
create policy bug_reports_user_select on public.bug_reports
  for select
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
