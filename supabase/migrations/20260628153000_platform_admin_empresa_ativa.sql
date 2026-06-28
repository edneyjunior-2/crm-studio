-- ============================================================================
-- CRM Studio — Platform Admin: seletor de empresa ativa
-- ============================================================================
-- Adiciona empresa_ativa_id ao profile do platform admin e redefine
-- current_empresa_id() para honrar o override quando is_platform_admin().
-- Adiciona RPC set_empresa_ativa (autenticada) para trocar o tenant ativo.
-- NÃO aplicar manualmente — o Opus aplica após OK do Edney.
-- ============================================================================

-- 1) Coluna empresa_ativa_id em profiles -----------------------------------
alter table public.profiles
  add column if not exists empresa_ativa_id uuid
    references public.empresas(id) on delete set null;

-- 2) Redefinir current_empresa_id() para honrar o override do platform admin
create or replace function public.current_empresa_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select case
    when public.is_platform_admin()
      then (select empresa_ativa_id from public.profiles where id = auth.uid())
    else (select empresa_id from public.profiles where id = auth.uid())
  end
$$;

-- 3) RPC para setar a empresa ativa (valida platform admin + existência) ----
create or replace function public.set_empresa_ativa(p_empresa uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden: not a platform admin';
  end if;
  if p_empresa is not null and not exists (select 1 from public.empresas where id = p_empresa) then
    raise exception 'empresa not found';
  end if;
  update public.profiles set empresa_ativa_id = p_empresa where id = auth.uid();
end $$;

grant execute on function public.set_empresa_ativa(uuid) to authenticated;

notify pgrst, 'reload schema';
