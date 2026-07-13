-- Adiciona a série "tempo_resolucao_por_dia" à RPC de estatísticas de
-- bug_reports usada na aba "Relatórios" em /admin/bugs.
--
-- Motivo: a chave `tempo_medio_resolucao_horas` já existente é um único
-- número agregado desde sempre — não mostra tendência. Esta migration
-- recria a função (create or replace, corpo idêntico ao de
-- 20260711000000_bug_reports_estatisticas.sql) só adicionando essa chave
-- nova. NÃO editar a migration antiga: ela já foi aplicada em produção.
--
-- `tempo_resolucao_por_dia` é uma série IRMÃ de `por_dia` — não confundir
-- "quantos bugs abriram" (por_dia, agrupado por created_at) com "quanto
-- tempo levou pra resolver" (agrupado por updated_at, só status=resolvido).
-- Dia sem nenhuma resolução vem com horas_medias null (não 0 — zero horas
-- de resolução seria enganoso, pareceria "resolveu instantâneo").
--
-- Segurança: mantém security definer + o REVOKE FROM PUBLIC no final. O
-- REVOKE já aplicado pela migration anterior não é desfeito por um
-- `create or replace function` (grants não são resetados por replace), mas
-- repetimos aqui por clareza/defesa, conforme a spec pede.
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
    ),
    'tempo_resolucao_por_dia', (
      -- Série contínua dos últimos 30 dias, mas agrupada pelo dia de
      -- RESOLUÇÃO (updated_at::date) — não de abertura, como em `por_dia`.
      -- Só entram bugs com status = 'resolvido'. Dia sem resolução nenhuma
      -- fica com horas_medias null e resolvidos 0 (left join não acha linha
      -- em c, round(null) continua null).
      select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(dia, 'YYYY-MM-DD'), 'horas_medias', horas_medias, 'resolvidos', resolvidos) order by dia), '[]'::jsonb)
      from (
        select d.dia::date as dia,
               round((c.horas_medias)::numeric, 1) as horas_medias,
               coalesce(c.resolvidos, 0) as resolvidos
        from generate_series(current_date - interval '29 days', current_date, interval '1 day') as d(dia)
        left join (
          select updated_at::date as dia,
                 avg(extract(epoch from (updated_at - created_at)) / 3600.0) as horas_medias,
                 count(*) as resolvidos
          from public.bug_reports
          where status = 'resolvido'
            and updated_at >= current_date - interval '29 days'
          group by 1
        ) c on c.dia = d.dia::date
        order by d.dia
      ) s
    )
  );
$$;

revoke execute on function public.bug_reports_estatisticas() from public;

notify pgrst, 'reload schema';
