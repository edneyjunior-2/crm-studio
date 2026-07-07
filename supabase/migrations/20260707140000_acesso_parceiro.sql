-- =============================================================================
-- Acesso de parceiro externo — portal read-only dos processos dele
-- =============================================================================
-- Novo role 'parceiro': usuário EXTERNO convidado pelo escritório (quem trouxe
-- o processo). Enxerga SOMENTE os processos onde processos_juridicos.parceiro_id
-- = o próprio auth.uid(), somente leitura, e ZERO acesso às tabelas-filhas
-- (movimentações, documentos, prazos, histórico interno) — mesmo que bata direto
-- na PostgREST API com o JWT dele.
--
-- A UI (RBAC modulos_permitidos=['processos'] + esconder abas/botões) é só
-- conveniência. A fronteira real é esta migration.
--
-- NÃO aplicar sem revisão. NOTIFY pgrst no final.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) profiles.role — amplia o CHECK para incluir 'parceiro'
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'socio', 'comercial', 'parceiro'));

comment on column public.profiles.role is
  'admin | socio | comercial | parceiro (parceiro = portal externo, só processos vinculados via processos_juridicos.parceiro_id)';

-- -----------------------------------------------------------------------------
-- 2) processos_juridicos.parceiro_id — QUEM trouxe o processo (perfil do
--    parceiro). Distinto de public.parceiros (indicador comercial sem login) —
--    aqui é um profile com login (role='parceiro').
-- -----------------------------------------------------------------------------
alter table public.processos_juridicos
  add column if not exists parceiro_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_processos_parceiro on public.processos_juridicos (parceiro_id);

-- -----------------------------------------------------------------------------
-- 3) RLS — processos_juridicos
--    SELECT: mesma empresa E (não é parceiro OU o processo é dele).
--    INSERT: parceiro nunca insere (some da lista "todos inserem").
--    UPDATE/DELETE: já são allow-list positivo (admin/socio, ou comercial dono
--    do processo, ou admin) — parceiro já fica de fora automaticamente, sem
--    precisar mexer (ver 20260619010000_fix_processos_rls.sql).
-- -----------------------------------------------------------------------------
drop policy if exists "processos: todos leem" on public.processos_juridicos;
create policy "processos: todos leem"
  on public.processos_juridicos
  as permissive for select
  using (
    auth.uid() is not null
    and (public.get_my_role() <> 'parceiro' or parceiro_id = auth.uid())
  );

drop policy if exists "processos: todos inserem" on public.processos_juridicos;
create policy "processos: todos inserem"
  on public.processos_juridicos
  as permissive for insert
  with check (auth.uid() is not null and public.get_my_role() <> 'parceiro');

-- -----------------------------------------------------------------------------
-- 4) RLS — tabelas-filhas de processos_juridicos (FK processo_id, enumeradas
--    via grep -rn "references.*processos_juridicos" em supabase/migrations/).
--    Parceiro = ZERO acesso (nem leitura, nem escrita), mesmo em processo dele.
--
--    Enumeração completa encontrada (5 tabelas com FK real; "partes adversas"
--    e "honorários" são COLUNAS de processos_juridicos, não tabelas — já
--    cobertas pela policy de SELECT acima):
--      - movimentacoes_processo          → fechada abaixo
--      - movimentacoes_internas_processo → fechada abaixo
--      - processos_prazos                → fechada abaixo
--      - processos_documentos            → fechada abaixo
--      - contas_pagar (processo_id)      → NÃO precisa mudar: já é allow-list
--        "admin e socio" (001_initial_schema.sql), parceiro já fica de fora.
-- -----------------------------------------------------------------------------

-- movimentacoes_processo (andamentos DataJud + manuais)
drop policy if exists "movimentacoes: todos leem" on public.movimentacoes_processo;
create policy "movimentacoes: todos leem"
  on public.movimentacoes_processo
  as permissive for select
  using (auth.uid() is not null and public.get_my_role() <> 'parceiro');

drop policy if exists "movimentacoes: todos inserem" on public.movimentacoes_processo;
create policy "movimentacoes: todos inserem"
  on public.movimentacoes_processo
  as permissive for insert
  with check (auth.uid() is not null and public.get_my_role() <> 'parceiro');

drop policy if exists "movimentacoes: todos atualizam" on public.movimentacoes_processo;
create policy "movimentacoes: todos atualizam"
  on public.movimentacoes_processo
  as permissive for update
  using (auth.uid() is not null and public.get_my_role() <> 'parceiro')
  with check (auth.uid() is not null and public.get_my_role() <> 'parceiro');
-- "movimentacoes: admin deleta" já é allow-list (role='admin') — sem mudança.

-- movimentacoes_internas_processo (histórico interno — nunca pra parceiro)
drop policy if exists select_auth on public.movimentacoes_internas_processo;
create policy select_auth on public.movimentacoes_internas_processo
  for select to authenticated
  using (public.get_my_role() <> 'parceiro');

drop policy if exists insert_auth on public.movimentacoes_internas_processo;
create policy insert_auth on public.movimentacoes_internas_processo
  for insert to authenticated
  with check (public.get_my_role() <> 'parceiro');
-- Sem policy de UPDATE nesta tabela (já era default-deny). "delete_admin" já é
-- allow-list (role='admin') — sem mudança.

-- processos_prazos (prazos processuais)
drop policy if exists select_auth on public.processos_prazos;
create policy select_auth on public.processos_prazos
  for select to authenticated
  using (public.get_my_role() <> 'parceiro');

drop policy if exists insert_auth on public.processos_prazos;
create policy insert_auth on public.processos_prazos
  for insert to authenticated
  with check (public.get_my_role() <> 'parceiro');

drop policy if exists update_auth on public.processos_prazos;
create policy update_auth on public.processos_prazos
  for update
  using (public.get_my_role() <> 'parceiro')
  with check (public.get_my_role() <> 'parceiro');
-- "delete_admin" já é allow-list (role='admin') — sem mudança.

-- processos_documentos (GED — nunca pra parceiro)
drop policy if exists select_auth on public.processos_documentos;
create policy select_auth on public.processos_documentos
  for select to authenticated
  using (public.get_my_role() <> 'parceiro');

drop policy if exists insert_auth on public.processos_documentos;
create policy insert_auth on public.processos_documentos
  for insert to authenticated
  with check (public.get_my_role() <> 'parceiro');

-- delete_own_or_admin: parceiro nunca insere (autor_id nunca é dele) e nunca é
-- admin, então já ficaria de fora na prática — reforça explicitamente mesmo
-- assim (defesa em profundidade, sem depender desse raciocínio implícito).
drop policy if exists delete_own_or_admin on public.processos_documentos;
create policy delete_own_or_admin on public.processos_documentos
  for delete
  using (
    public.get_my_role() <> 'parceiro'
    and (autor_id = auth.uid() or (select role from profiles where id = auth.uid()) = 'admin')
  );

notify pgrst, 'reload schema';
