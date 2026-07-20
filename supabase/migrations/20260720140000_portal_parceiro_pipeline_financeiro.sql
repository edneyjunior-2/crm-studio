-- =============================================================================
-- Portal do parceiro — Pipeline + Financeiro
-- =============================================================================
-- Amplia o portal externo do role 'parceiro' (hoje só processos jurídicos, ver
-- 20260707140000_acesso_parceiro.sql) para duas abas novas:
--
--   Pipeline   → só os negócios que a equipe marcou como indicados por ele
--   Financeiro → só as comissões lançadas no nome dele (a receber / recebidas)
--
-- Processos continua exatamente como está (tenants de advocacia).
--
-- O elo que faltava: public.parceiros (cadastro do indicador comercial) não
-- tinha NENHUMA ligação com o login. Sem ela é impossível resolver
-- "usuário logado → negócios dele". Resolvido por parceiros.profile_id.
--
-- TUDO aqui é ADITIVO: policies novas condicionadas a get_my_role()='parceiro'.
-- Nenhuma policy existente é alterada ou removida — admin/socio/comercial não
-- mudam de comportamento.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Vínculo cadastro de parceiro ↔ login
-- -----------------------------------------------------------------------------
alter table public.parceiros
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_parceiros_profile_id on public.parceiros (profile_id);

comment on column public.parceiros.profile_id is
  'Login do portal (profiles.role=''parceiro'') deste cadastro de parceiro. NULL = parceiro sem acesso ao sistema. É o que liga negocios.parceiro_id ao usuário logado.';

-- -----------------------------------------------------------------------------
-- 2) Helper: ids dos cadastros de parceiro do usuário logado
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER é obrigatório aqui, não é conveniência: public.parceiros está
-- fechada para o role 'parceiro' (policy parceiros_select tem
-- `get_my_role() <> 'parceiro'`, ver 20260707150000). Uma subquery crua dentro
-- da policy de negocios sofreria essa mesma RLS e voltaria SEMPRE vazia — o
-- parceiro nunca veria negócio nenhum. Mesmo padrão de public.get_my_role().
create or replace function public.meus_parceiro_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(id), '{}')::uuid[]
  from public.parceiros
  where profile_id = auth.uid();
$$;

revoke all on function public.meus_parceiro_ids() from public;
grant execute on function public.meus_parceiro_ids() to authenticated;

comment on function public.meus_parceiro_ids() is
  'Ids de public.parceiros vinculados ao usuário logado (profile_id = auth.uid()). SECURITY DEFINER porque public.parceiros é negada ao role parceiro.';

-- -----------------------------------------------------------------------------
-- 3) RLS — negocios: parceiro lê SÓ os negócios que ele indicou
-- -----------------------------------------------------------------------------
-- Policy permissiva nova, somando-se às existentes (admin/socio veem todos,
-- comercial vê os seus). Para admin/socio/comercial esta policy é sempre FALSE
-- (o guard de role), então não amplia nada para eles.
--
-- Sem policy de INSERT/UPDATE/DELETE: as de negocios são allow-list positivo
-- (só admin/socio/comercial), então o parceiro segue sem poder escrever.
--
-- `parceiro_id is not null` é redundante com o `= any(...)` (NULL = any nunca é
-- true), mas fica explícito para deixar claro que negócio SEM parceiro nunca é
-- visível — é o caso mais comum da base e o erro mais caro se alguém mexer aqui.
--
-- O `empresa_id = current_empresa_id()` também é redundante HOJE: a policy
-- RESTRICTIVE tenant_isolation (20260611180000) já corta o tenant. Fica explícito
-- de propósito porque meus_parceiro_ids() é SECURITY DEFINER e devolve ids de
-- QUALQUER tenant (um admin pode gravar profile_id apontando pra fora) — sem a
-- RESTRICTIVE, esta policy sozinha seria cross-tenant. Cinto de segurança contra
-- o gotcha "hardening de RLS não replicado", que já mordeu este projeto.
drop policy if exists "negocios: parceiro ve os que indicou" on public.negocios;
create policy "negocios: parceiro ve os que indicou"
  on public.negocios
  as permissive for select
  using (
    public.get_my_role() = 'parceiro'
    and empresa_id = public.current_empresa_id()
    and parceiro_id is not null
    and parceiro_id = any (public.meus_parceiro_ids())
  );

-- -----------------------------------------------------------------------------
-- 4) RLS — pipeline_estagios: parceiro lê as colunas do funil
-- -----------------------------------------------------------------------------
-- Sem isso a tela do parceiro não tem em que agrupar os negócios: a policy
-- pipeline_estagios_all (FOR ALL) o exclui explicitamente.
-- Policy SEPARADA e só de SELECT — a FOR ALL fica intocada, então escrita
-- (criar/editar/reordenar etapa) continua negada.
drop policy if exists pipeline_estagios_parceiro_select on public.pipeline_estagios;
create policy pipeline_estagios_parceiro_select
  on public.pipeline_estagios
  as permissive for select
  using (
    empresa_id = public.current_empresa_id()
    and public.get_my_role() = 'parceiro'
  );

-- -----------------------------------------------------------------------------
-- 5) RLS — comissoes_comercial: parceiro lê SÓ as comissões dele
-- -----------------------------------------------------------------------------
-- comercial_id é o beneficiário da comissão. Com o parceiro sendo um usuário de
-- verdade, a equipe lança a comissão no nome dele e a tela "Minhas Comissões"
-- (que já filtra por comercial_id) funciona sem tela nova.
drop policy if exists comissoes_select_parceiro on public.comissoes_comercial;
create policy comissoes_select_parceiro
  on public.comissoes_comercial
  as permissive for select to authenticated
  using (
    public.get_my_role() = 'parceiro'
    and comercial_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 6) RBAC — abas liberadas para quem JÁ é parceiro
-- -----------------------------------------------------------------------------
-- O convite passa a gravar este array (ver configuracoes/actions.ts), mas quem
-- já foi convidado continuaria preso em ['processos'] e nunca veria as abas
-- novas. Backfill restrito ao role 'parceiro' — não toca em mais ninguém.
-- 'processos' fica no array de propósito: a interseção com modulosEfetivos() do
-- tenant já esconde a aba em quem não tem o módulo de advocacia.
-- 'comissoes' é obrigatório junto com 'financeiro': a tela do parceiro é
-- /financeiro/comissoes, gateada por requireModulo('comissoes').
update public.profiles
   set modulos_permitidos = array['pipeline', 'financeiro', 'comissoes', 'processos']
 where role = 'parceiro';

notify pgrst, 'reload schema';
