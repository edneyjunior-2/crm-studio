-- RPC de estatísticas de bug_reports pra aba "Relatórios" em /admin/bugs.
-- Toda a agregação (contagem por status/severidade/categoria/empresa, série
-- de 30 dias, tempo médio de resolução) acontece aqui dentro em SQL — o
-- Server Component só chama esta função uma vez via supabase.rpc(...).
-- GOTCHA do projeto: nunca buscar linhas cruas de bug_reports pra contar em
-- JS (PostgREST trunca em 1000 linhas, .limit() não resolve).
--
-- Não mexe na tabela bug_reports (criada fora de migration, no Supabase
-- Studio) — só adiciona a função.
--
-- Segurança: é `security definer` (bypassa RLS pra agregar entre tenants) e
-- só é chamada pelo app via createAdminClient() (service role), já gated
-- por getAuthPlatformAdmin() antes disso. O Postgres concede EXECUTE a
-- PUBLIC por padrão em toda função nova — sem o REVOKE abaixo, qualquer
-- usuário autenticado (não só platform admin) poderia chamar essa RPC
-- direto pela API do Supabase e ver nome de empresa + contagem de bugs de
-- TODOS os tenants, ignorando a proteção da tela. `service_role` não é
-- afetado pelo REVOKE FROM PUBLIC (tem grant próprio, concedido pelo
-- Supabase na criação do projeto), então a chamada legítima continua ok.
create or replace function public.bug_reports_estatisticas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'por_status', (
      select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
      from (
        select status, count(*) as total
        from public.bug_reports
        group by status
      ) s
    ),
    'por_severidade', (
      -- analise_claude é jsonb; bug ainda não analisado (analise_claude is
      -- null ou sem a chave 'severidade') cai no bucket "sem_analise".
      select coalesce(jsonb_object_agg(severidade, total), '{}'::jsonb)
      from (
        select coalesce(analise_claude ->> 'severidade', 'sem_analise') as severidade,
               count(*) as total
        from public.bug_reports
        group by 1
      ) s
    ),
    'por_categoria', (
      -- Bug sem análise cai em "sem_categoria" — participa do ranking em vez
      -- de simplesmente desaparecer da agregação.
      select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'total', total) order by total desc), '[]'::jsonb)
      from (
        select coalesce(analise_claude ->> 'categoria', 'sem_categoria') as categoria,
               count(*) as total
        from public.bug_reports
        group by 1
        order by total desc
        limit 10
      ) s
    ),
    'por_empresa', (
      -- left join: empresa_id nulo ou empresa deletada não pode derrubar a
      -- agregação — cai no fallback "Empresa removida".
      select coalesce(jsonb_agg(jsonb_build_object('empresa_nome', empresa_nome, 'total', total) order by total desc), '[]'::jsonb)
      from (
        select coalesce(e.nome, 'Empresa removida') as empresa_nome,
               count(*) as total
        from public.bug_reports b
        left join public.empresas e on e.id = b.empresa_id
        group by 1
        order by total desc
        limit 10
      ) s
    ),
    'por_dia', (
      -- Série contínua dos últimos 30 dias (hoje incluso) via generate_series
      -- + left join, pra dia sem bug aparecer com total 0 em vez de sumir.
      select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(dia, 'YYYY-MM-DD'), 'total', total) order by dia), '[]'::jsonb)
      from (
        select d.dia::date as dia, coalesce(c.total, 0) as total
        from generate_series(current_date - interval '29 days', current_date, interval '1 day') as d(dia)
        left join (
          select created_at::date as dia, count(*) as total
          from public.bug_reports
          where created_at >= current_date - interval '29 days'
          group by 1
        ) c on c.dia = d.dia::date
        order by d.dia
      ) s
    ),
    'tempo_medio_resolucao_horas', (
      select round((avg(extract(epoch from (updated_at - created_at))) / 3600.0)::numeric, 1)
      from public.bug_reports
      where status = 'resolvido'
    )
  );
$$;

revoke execute on function public.bug_reports_estatisticas() from public;

notify pgrst, 'reload schema';
