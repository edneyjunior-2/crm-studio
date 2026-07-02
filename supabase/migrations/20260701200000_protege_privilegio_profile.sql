-- CRÍTICO (auditoria round 3): a RLS de profiles permitia um usuário fazer PATCH
-- na própria linha via API pública e se autopromover a role='admin' ou trocar o
-- próprio empresa_id p/ outro tenant (escalação de privilégio + sequestro de tenant).
--
-- Fix defensivo em profundidade: trigger que IMPEDE um usuário de alterar a PRÓPRIA
-- role ou o PRÓPRIO empresa_id (quando já definido). Continua permitindo:
--   • admin trocar a role de OUTRO usuário (new.id <> auth.uid());
--   • onboarding: setar empresa_id pela 1ª vez (old.empresa_id IS NULL);
--   • trocar o próprio nome / outros campos não-privilegiados;
--   • operações do app via service-role (createAdminClient), que bypassa.

create or replace function public.protege_privilegio_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');

  -- service_role (admin client do servidor) tem passe livre — o app já gateia via getAuthAdmin.
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- O usuário NÃO pode alterar os próprios privilégios pela API do usuário.
  if new.id = auth.uid() then
    if new.role is distinct from old.role then
      raise exception 'Alteração de role não permitida.' using errcode = '42501';
    end if;
    if new.empresa_id is distinct from old.empresa_id and old.empresa_id is not null then
      raise exception 'Alteração de empresa não permitida.' using errcode = '42501';
    end if;
    if new.modulos_permitidos is distinct from old.modulos_permitidos then
      raise exception 'Alteração de módulos não permitida.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protege_privilegio_profile on public.profiles;
create trigger trg_protege_privilegio_profile
  before update on public.profiles
  for each row
  execute function public.protege_privilegio_profile();

notify pgrst, 'reload schema';
