-- ============================================================================
-- FIX: módulos Estoque/RH tinham SOMENTE policy RESTRICTIVE (tenant_isolation),
-- sem nenhuma PERMISSIVE. Com RLS habilitada, isso NEGA TUDO (nem o admin acessa).
-- Pego em teste funcional end-to-end. Adiciona as policies PERMISSIVE de RBAC, que
-- fazem AND com a RESTRICTIVE de tenant (acesso = papel certo E mesma empresa).
--   RH (dados sensíveis): admin-only.
--   Estoque: admin/sócio (nível financeiro).
-- ============================================================================

-- RH — admin only
drop policy if exists rbac_acesso on public.colaboradores;
create policy rbac_acesso on public.colaboradores as permissive for all
  using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

drop policy if exists rbac_acesso on public.ausencias;
create policy rbac_acesso on public.ausencias as permissive for all
  using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

drop policy if exists rbac_acesso on public.lancamentos_folha;
create policy rbac_acesso on public.lancamentos_folha as permissive for all
  using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

-- Estoque — admin/sócio
drop policy if exists rbac_acesso on public.produtos;
create policy rbac_acesso on public.produtos as permissive for all
  using (public.get_my_role() in ('admin','socio')) with check (public.get_my_role() in ('admin','socio'));

drop policy if exists rbac_acesso on public.movimentacoes_estoque;
create policy rbac_acesso on public.movimentacoes_estoque as permissive for all
  using (public.get_my_role() in ('admin','socio')) with check (public.get_my_role() in ('admin','socio'));

notify pgrst, 'reload schema';
