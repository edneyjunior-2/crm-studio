-- RBAC: permissão de módulo por usuário. NULL = sem restrição (vê todos os módulos
-- da empresa). Setado = restrito aos slugs listados. Admin ignora (sempre full).
alter table public.profiles
  add column if not exists modulos_permitidos text[];

notify pgrst, 'reload schema';
