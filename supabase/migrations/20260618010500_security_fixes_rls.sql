-- =====================================================================
-- Migration: 20260618_security_fixes_rls.sql
-- Correcao de policies RLS inseguras (SELECT com USING (true)).
--
-- Contexto: varias tabelas foram criadas com a policy de SELECT em
-- USING (true), o que permite que QUALQUER usuario autenticado leia
-- TODAS as linhas, ignorando o RBAC e (futuramente) o isolamento por
-- empresa. Esta migration fecha esses vazamentos.
--
-- Itens corrigidos:
--   1. public.bancos          -> SELECT so para admin/socio (financeiro)
--   2. public.movimentacoes   -> SELECT so para admin/socio (financeiro)
--   3. public.calendario_eventos -> SELECT so do proprio organizador
--   4. public.calendario_notas    -> SELECT so do proprio dono (updated_by)
--
-- get_my_role(): funcao STABLE SECURITY DEFINER definida na 001 e
-- recriada na 20260611180000; retorna o role (text) do usuario atual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) FINANCEIRO: bancos
--    Problema: "bancos_select" usava USING (true) -> role 'comercial'
--    conseguia ler saldo_inicial e dados bancarios de todas as contas.
--    Fix: restringe a leitura a admin/socio, alinhado ao RBAC
--    (comercial NUNCA acessa financeiro).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "bancos_select" ON public.bancos;

CREATE POLICY "bancos_select" ON public.bancos
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin', 'socio'));

-- ---------------------------------------------------------------------
-- 2) FINANCEIRO: movimentacoes
--    Problema: "movimentacoes_select" usava USING (true) -> role
--    'comercial' conseguia ler todas as entradas/saidas financeiras.
--    Fix: restringe a leitura a admin/socio.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "movimentacoes_select" ON public.movimentacoes;

CREATE POLICY "movimentacoes_select" ON public.movimentacoes
  FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin', 'socio'));

-- ---------------------------------------------------------------------
-- 3) CALENDARIO: calendario_eventos
--    Problema: "calendario_eventos_select" usava USING (true) ->
--    leitura cross-tenant de todos os eventos rastreados.
--    Fix paliativo (sem empresa_id ainda): restringe a leitura ao
--    proprio organizador. Coluna existente: organizer_user_id.
--    OBS: organizer_user_id e nullable (ON DELETE SET NULL); linhas
--    com organizer_user_id NULL deixam de ser visiveis ate haver
--    isolamento por empresa, o que e o comportamento seguro desejado.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "calendario_eventos_select" ON public.calendario_eventos;

CREATE POLICY "calendario_eventos_select" ON public.calendario_eventos
  FOR SELECT TO authenticated
  USING (auth.uid() = organizer_user_id);

-- ---------------------------------------------------------------------
-- 4) CALENDARIO: calendario_notas
--    Problema: "notas_select" usava USING (true) -> leitura cross-tenant
--    de todas as notas de eventos.
--    Fix paliativo (sem empresa_id ainda): restringe a leitura ao
--    proprio dono. ATENCAO: esta tabela NAO tem user_id nem
--    organizer_user_id; a unica coluna de dono e updated_by
--    (NOT NULL, referencia auth.users). Por isso usamos updated_by.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "notas_select" ON public.calendario_notas;

CREATE POLICY "notas_select" ON public.calendario_notas
  FOR SELECT TO authenticated
  USING (auth.uid() = updated_by);

-- Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
