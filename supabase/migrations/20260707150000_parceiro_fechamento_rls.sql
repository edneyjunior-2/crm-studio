-- CRÍTICO (revisão adversarial 2026-07-07): fechamento do isolamento do papel
-- 'parceiro' (usuário EXTERNO). Complementa 20260707140000_acesso_parceiro.sql,
-- que fechou só processos_juridicos + 5 filhas. A revisão mostrou que o parceiro
-- é membro do tenant do escritório (profiles.empresa_id = empresa), então TODA
-- policy `auth.uid() is not null` / `using(true)` / só `empresa_id = current_empresa_id()`
-- deixa ele ler (e às vezes escrever) via PostgREST/Storage direto com o JWT dele.
--
-- Padrão: adiciona `and public.get_my_role() <> 'parceiro'` sem afetar
-- admin/socio/comercial (para eles a condição é sempre TRUE → no-op; perfil sem
-- role → NULL → fail-closed). Nomes de policy confirmados em prod.
-- comprovantes.public já é false em prod (não precisa flip).

-- ===== CRÍTICO: carteira de clientes =====================================
alter policy "clientes: todos leem"    on public.clientes
  using (auth.uid() is not null and public.get_my_role() <> 'parceiro');
alter policy "clientes: todos inserem" on public.clientes
  with check (auth.uid() is not null and public.get_my_role() <> 'parceiro');

-- ===== catálogo / parceiros =============================================
alter policy solucoes_tenant_select on public.solucoes
  using ((empresa_id = public.current_empresa_id() or public.is_platform_admin())
         and public.get_my_role() <> 'parceiro');
alter policy parceiros_select on public.parceiros
  using (public.get_my_role() <> 'parceiro');

-- ===== OBRAS (leitura + escrita) ========================================
alter policy select_auth on public.obras          using (public.get_my_role() <> 'parceiro');
alter policy insert_auth on public.obras          with check (public.get_my_role() <> 'parceiro');
alter policy update_auth on public.obras          using (public.get_my_role() <> 'parceiro') with check (public.get_my_role() <> 'parceiro');
alter policy select_auth on public.obras_etapas   using (public.get_my_role() <> 'parceiro');
alter policy insert_auth on public.obras_etapas   with check (public.get_my_role() <> 'parceiro');
alter policy update_auth on public.obras_etapas   using (public.get_my_role() <> 'parceiro') with check (public.get_my_role() <> 'parceiro');
alter policy select_auth on public.obras_medicoes using (public.get_my_role() <> 'parceiro');
alter policy insert_auth on public.obras_medicoes with check (public.get_my_role() <> 'parceiro');
alter policy update_auth on public.obras_medicoes using (public.get_my_role() <> 'parceiro') with check (public.get_my_role() <> 'parceiro');
alter policy select_all  on public.obras_colaboradores using (public.get_my_role() <> 'parceiro');
alter policy insert_auth on public.obras_colaboradores with check (public.get_my_role() <> 'parceiro');
alter policy update_auth on public.obras_colaboradores using (public.get_my_role() <> 'parceiro') with check (public.get_my_role() <> 'parceiro');
alter policy select_all  on public.pontos using (public.get_my_role() <> 'parceiro');
alter policy insert_auth on public.pontos with check (public.get_my_role() <> 'parceiro');
alter policy update_auth on public.pontos using (public.get_my_role() <> 'parceiro') with check (public.get_my_role() <> 'parceiro');

-- ===== ORÇAMENTOS =======================================================
alter policy select_auth on public.orcamentos      using (public.get_my_role() <> 'parceiro');
alter policy insert_auth on public.orcamentos      with check (public.get_my_role() <> 'parceiro');
alter policy update_auth on public.orcamentos      using (public.get_my_role() <> 'parceiro') with check (public.get_my_role() <> 'parceiro');
alter policy select_auth on public.orcamento_itens using (public.get_my_role() <> 'parceiro');
alter policy insert_auth on public.orcamento_itens with check (public.get_my_role() <> 'parceiro');
alter policy update_auth on public.orcamento_itens using (public.get_my_role() <> 'parceiro') with check (public.get_my_role() <> 'parceiro');
alter policy delete_auth on public.orcamento_itens using (public.get_my_role() <> 'parceiro');

-- ===== FOR ALL (leitura+escrita+delete numa policy só) ==================
alter policy pipeline_estagios_all on public.pipeline_estagios
  using (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro')
  with check (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro');
alter policy negocio_produtos_all on public.negocio_produtos
  using (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro')
  with check (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro');
alter policy medicao_etapas_all on public.medicao_etapas
  using (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro')
  with check (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro');

-- ===== contratos gerados (PII) ==========================================
alter policy contratos_gerados_select on public.contratos_gerados
  using (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro');
alter policy contratos_gerados_insert on public.contratos_gerados
  with check (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro');
alter policy contratos_gerados_delete on public.contratos_gerados
  using (empresa_id = public.current_empresa_id() and public.get_my_role() <> 'parceiro');

-- ===== STORAGE (buckets role-agnósticos — parceiro baixava direto) ======
alter policy processos_docs_select on storage.objects
  using (bucket_id = 'processos-docs' and public.get_my_role() <> 'parceiro');
alter policy processos_docs_insert on storage.objects
  with check (bucket_id = 'processos-docs' and public.get_my_role() <> 'parceiro');
alter policy contratos_select on storage.objects
  using (bucket_id = 'contratos' and public.get_my_role() <> 'parceiro');
alter policy contratos_insert on storage.objects
  with check (bucket_id = 'contratos' and public.get_my_role() <> 'parceiro');
alter policy contratos_delete on storage.objects
  using (bucket_id = 'contratos' and public.get_my_role() <> 'parceiro');
alter policy comprovantes_select on storage.objects
  using (bucket_id = 'comprovantes' and public.get_my_role() <> 'parceiro');
alter policy comprovantes_upload on storage.objects
  with check (bucket_id = 'comprovantes' and public.get_my_role() <> 'parceiro');

notify pgrst, 'reload schema';
