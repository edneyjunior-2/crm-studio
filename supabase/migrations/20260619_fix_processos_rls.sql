-- ============================================================================
-- FIX: módulo Processos (advocacia) tinha SOMENTE policy RESTRICTIVE
-- (tenant_isolation), sem nenhuma PERMISSIVE. Com RLS habilitada, isso NEGA
-- TUDO para o role authenticated — o advogado não consegue cadastrar nem listar
-- processos (a tela cai em notFound/lista vazia). Mesmo bug já pego em Estoque/RH
-- (ver 20260614200000_fix_modulos_rls.sql).
--
-- Adiciona as policies PERMISSIVE, que fazem AND com a RESTRICTIVE de tenant
-- (acesso = regra abaixo E mesma empresa). Modelo do escritório: todos do tenant
-- leem/cadastram os processos do escritório; admin/sócio gerenciam todos;
-- comercial só altera os processos em que é o advogado responsável.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- processos_juridicos
-- ---------------------------------------------------------------------------
drop policy if exists "processos: todos leem" on public.processos_juridicos;
create policy "processos: todos leem"
  on public.processos_juridicos
  as permissive for select
  using (auth.uid() is not null);

drop policy if exists "processos: todos inserem" on public.processos_juridicos;
create policy "processos: todos inserem"
  on public.processos_juridicos
  as permissive for insert
  with check (auth.uid() is not null);

drop policy if exists "processos: admin e socio atualizam todos" on public.processos_juridicos;
create policy "processos: admin e socio atualizam todos"
  on public.processos_juridicos
  as permissive for update
  using (public.get_my_role() in ('admin', 'socio'))
  with check (public.get_my_role() in ('admin', 'socio'));

drop policy if exists "processos: comercial atualiza os seus" on public.processos_juridicos;
create policy "processos: comercial atualiza os seus"
  on public.processos_juridicos
  as permissive for update
  using (public.get_my_role() = 'comercial' and advogado_id = auth.uid())
  with check (public.get_my_role() = 'comercial' and advogado_id = auth.uid());

drop policy if exists "processos: admin deleta" on public.processos_juridicos;
create policy "processos: admin deleta"
  on public.processos_juridicos
  as permissive for delete
  using (public.get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- movimentacoes_processo
-- (andamentos vêm do DataJud; usuário lê e marca como lido)
-- ---------------------------------------------------------------------------
drop policy if exists "movimentacoes: todos leem" on public.movimentacoes_processo;
create policy "movimentacoes: todos leem"
  on public.movimentacoes_processo
  as permissive for select
  using (auth.uid() is not null);

drop policy if exists "movimentacoes: todos inserem" on public.movimentacoes_processo;
create policy "movimentacoes: todos inserem"
  on public.movimentacoes_processo
  as permissive for insert
  with check (auth.uid() is not null);

drop policy if exists "movimentacoes: todos atualizam" on public.movimentacoes_processo;
create policy "movimentacoes: todos atualizam"
  on public.movimentacoes_processo
  as permissive for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "movimentacoes: admin deleta" on public.movimentacoes_processo;
create policy "movimentacoes: admin deleta"
  on public.movimentacoes_processo
  as permissive for delete
  using (public.get_my_role() = 'admin');

notify pgrst, 'reload schema';
