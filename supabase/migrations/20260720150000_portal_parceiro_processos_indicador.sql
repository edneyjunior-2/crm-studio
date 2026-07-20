-- =============================================================================
-- Portal do parceiro — processos indicados (vertical advocacia)
-- =============================================================================
-- Complementa 20260720140000. Auditoria nos dados de prod mostrou que os dois
-- tenants ligam o parceiro por caminhos OPOSTOS, sem sobreposição:
--
--   Aurumtax  → negocios.parceiro_id                     (29 negócios, 0 processos)
--   Saturnino → processos_juridicos.indicador_parceiro_id ( 0 negócios, 6 processos)
--
-- E processos_juridicos.parceiro_id — o campo que o portal de processos usa
-- desde 20260707140000 — está NULO em 100% da base. Ou seja: um parceiro da
-- Saturnino logaria e veria as duas abas vazias, porque o portal procura o
-- vínculo dele num campo que ninguém preenche.
--
-- Em vez de fazer a equipe preencher parceiro_id à mão em todo processo novo
-- (hoje ela só preenche o indicador), o portal passa a resolver pelo MESMO
-- caminho do pipeline: login → cadastro em public.parceiros → indicador.
-- O cadastro vira a âncora única nos dois modelos.
--
-- ADITIVO: policy permissiva nova, que soma (OR) com "processos: todos leem".
-- Nenhuma policy existente é tocada; parceiro_id continua funcionando pra quem
-- eventualmente o use.
-- =============================================================================

drop policy if exists "processos: parceiro ve os que indicou" on public.processos_juridicos;
create policy "processos: parceiro ve os que indicou"
  on public.processos_juridicos
  as permissive for select
  using (
    public.get_my_role() = 'parceiro'
    and empresa_id = public.current_empresa_id()
    and indicador_parceiro_id is not null
    and indicador_parceiro_id = any (public.meus_parceiro_ids())
  );

-- Sem INSERT/UPDATE/DELETE: 20260707140000 já fecha escrita pro parceiro
-- ("processos: todos inserem" exige get_my_role() <> 'parceiro'; update/delete
-- são allow-list positivo).

-- -----------------------------------------------------------------------------
-- Fecha a 5ª tabela-filha: processos_clientes
-- -----------------------------------------------------------------------------
-- DÍVIDA PRÉ-EXISTENTE, corrigida aqui porque é esta migration que dá ao
-- parceiro acesso real a processos pela primeira vez (parceiro_id era nulo em
-- 100% da base, ou seja, o caminho estava morto).
--
-- processos_clientes nasceu em 20260709200000, DEPOIS do hardening de
-- 20260707140000 — cuja enumeração de tabelas-filhas conhecia só 4 e não podia
-- prever esta. Ficou com `using (true)` / `with check (true)`, freada apenas
-- pela RESTRICTIVE tenant_isolation. Efeito: com o JWT dele, o parceiro lia o
-- grafo processo↔cliente do TENANT INTEIRO e, pior, podia APAGAR vínculos de
-- qualquer processo do escritório via DELETE direto na PostgREST.
-- É o gotcha "hardening de RLS não replicado" acontecendo pela segunda vez.
--
-- Nomes de cliente já não vazavam (public.clientes é negada a ele), então o
-- lado grave era a escrita, não a leitura.
alter policy select_auth on public.processos_clientes
  using (public.get_my_role() <> 'parceiro');
alter policy insert_auth on public.processos_clientes
  with check (public.get_my_role() <> 'parceiro');
alter policy delete_auth on public.processos_clientes
  using (public.get_my_role() <> 'parceiro');

-- Com isso, as CINCO tabelas-filhas de processos_juridicos seguem 100% negadas
-- ao parceiro: movimentacoes_processo, movimentacoes_internas_processo,
-- processos_prazos, processos_documentos e processos_clientes. O portal mostra
-- a capa do processo, nunca o conteúdo interno do escritório.

notify pgrst, 'reload schema';
