-- CRÍTICO (codebase-guardian 2026-07-07): vazamento de `solucoes` ENTRE tenants.
--
-- As policies de solucoes vinham da base pré-multitenancy (001_initial_schema):
--   • SELECT "solucoes: todos leem"  USING (auth.uid() IS NOT NULL)
--       → qualquer usuário de QUALQUER empresa lia TODAS as soluções (as 4
--         soluções do Aurumtax apareciam no CRM de outros tenants).
--   • INSERT/UPDATE/DELETE por get_my_role()='admin' SEM escopo de empresa
--       → um admin de um tenant podia editar/APAGAR a solução de OUTRO tenant.
--         (O botão "excluir solução" num CRM apagava dados reais do Aurum.)
--
-- Fix: reescreve as 4 policies escopando por empresa_id = current_empresa_id()
-- (platform-admin bypassa no SELECT para o painel admin). Depende de
-- createSolucao passar a setar empresa_id (feito no mesmo commit).

drop policy if exists "solucoes: todos leem"   on public.solucoes;
drop policy if exists "solucoes: admin insere"  on public.solucoes;
drop policy if exists "solucoes: admin atualiza" on public.solucoes;
drop policy if exists "solucoes: admin deleta"  on public.solucoes;

-- Leitura: qualquer usuário do próprio tenant (comercial/sócio/admin) lê as
-- soluções da sua empresa; platform-admin vê todas (painel).
create policy solucoes_tenant_select on public.solucoes for select
  using (empresa_id = public.current_empresa_id() or public.is_platform_admin());

-- Escrita: só admin, e só na própria empresa.
create policy solucoes_tenant_insert on public.solucoes for insert
  with check (empresa_id = public.current_empresa_id() and public.get_my_role() = 'admin');

create policy solucoes_tenant_update on public.solucoes for update
  using (empresa_id = public.current_empresa_id() and public.get_my_role() = 'admin')
  with check (empresa_id = public.current_empresa_id());

create policy solucoes_tenant_delete on public.solucoes for delete
  using (empresa_id = public.current_empresa_id() and public.get_my_role() = 'admin');

notify pgrst, 'reload schema';
