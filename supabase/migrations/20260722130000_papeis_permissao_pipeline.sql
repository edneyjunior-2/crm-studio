-- ============================================================================
-- CRM Studio — Papéis customizáveis por empresa (Fase 2, fatia mínima:
-- permissão "ver pipeline completo")
-- ============================================================================
-- Spec: .claude/specs/papeis-customizaveis-02-permissao-pipeline.md
--
-- Fatia MÍNIMA da Fase 2 do roadmap (spec 01): implementa o mecanismo
-- `tem_permissao(chave)` lendo `papeis.permissoes` (jsonb já criado na Fase 1,
-- nunca lido até agora) e aplica UMA ÚNICA chave (`pipeline_visao_completa`)
-- só nas 3 tabelas que a tela de Pipeline usa: negocios, atividades,
-- followups. NÃO mexe nas outras ~87 policies do app que usam get_my_role().
--
-- 100% ADITIVO: nenhuma policy existente é alterada ou removida — só somamos
-- policies PERMISSIVE novas (SELECT apenas). `profiles.role` continua sendo a
-- fonte de verdade pra tudo que já funcionava; esta permissão só AMPLIA
-- visibilidade de leitura, nunca concede INSERT/UPDATE/DELETE em negócio
-- alheio.
-- ============================================================================

-- 1) Função tem_permissao(chave) — mesmo padrão de get_my_role() -------------
create or replace function public.tem_permissao(p_chave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (pa.permissoes ->> p_chave)::boolean
      from public.profiles pr
      join public.papeis pa on pa.id = pr.papel_id
      where pr.id = auth.uid()
    ),
    false
  )
$$;

-- 2) negocios: SELECT adicional pra quem tem a permissão --------------------
drop policy if exists "negocios: permissao pipeline_visao_completa" on public.negocios;
create policy "negocios: permissao pipeline_visao_completa"
  on public.negocios
  for select
  using (public.tem_permissao('pipeline_visao_completa'));

-- 3) atividades: SELECT adicional (timeline do negócio) ---------------------
drop policy if exists "atividades: permissao pipeline_visao_completa" on public.atividades;
create policy "atividades: permissao pipeline_visao_completa"
  on public.atividades
  for select
  using (public.tem_permissao('pipeline_visao_completa'));

-- 4) followups: SELECT adicional (mesma timeline) ----------------------------
-- followups usa policies FOR ALL (não separadas por comando) — a nova policy
-- fica restrita a FOR SELECT de propósito: não amplia INSERT/UPDATE/DELETE.
drop policy if exists "followups: permissao pipeline_visao_completa" on public.followups;
create policy "followups: permissao pipeline_visao_completa"
  on public.followups
  for select
  using (public.tem_permissao('pipeline_visao_completa'));

-- 5) Recarregar schema PostgREST ----------------------------------------------
NOTIFY pgrst, 'reload schema';
