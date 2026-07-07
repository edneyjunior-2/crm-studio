-- CRÍTICO (codebase-guardian 2026-07-03): escalada de billing/entitlement na
-- tabela public.empresas.
--
-- A policy empresa_admin_update permitia UPDATE quando id=current_empresa_id()
-- AND get_my_role()='admin', mas o WITH CHECK só pinava `plano` e `status` —
-- NÃO pinava colunas de billing adicionadas depois (modulos_ativos,
-- trial_ends_at, valor_mensalidade). Com `grant update on public.empresas to
-- authenticated`, um ADMIN de um tenant fazia um PATCH direto no PostgREST:
--
--   PATCH /rest/v1/empresas?id=eq.<sua_empresa>
--   { "modulos_ativos": ["processos","obras","estoque","rh","atendimentos"] }
--
-- e o WITH CHECK passava (plano/status inalterados). A partir daí gating.ts /
-- requireModulo liberavam todos os módulos pagos sem pagar; pelo mesmo caminho
-- dava pra esticar trial_ends_at (trial infinito) e reescrever valor_mensalidade.
--
-- Fix (defesa em profundidade, mínima): NENHUMA tela do CRM atualiza empresas
-- pelo client do usuário — toda escrita legítima é service-role (painel
-- platform-admin em (admin)/admin/empresas e configuracoes via createAdminClient,
-- que bypassa RLS/grant). Então basta REVOGAR o UPDATE do usuário e dropar a
-- policy permissiva. Fail-closed: se um dia precisar de edição pelo usuário,
-- adiciona-se um grant por-coluna das colunas seguras (nome/razao_social/cnpj/…),
-- nunca das de billing.

drop policy if exists empresa_admin_update on public.empresas;
revoke update on public.empresas from authenticated;

-- SELECT continua liberado pela policy empresa_self_select (inalterada).
notify pgrst, 'reload schema';
