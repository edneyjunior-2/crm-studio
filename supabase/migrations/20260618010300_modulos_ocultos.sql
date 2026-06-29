alter table public.empresas
  add column if not exists modulos_ocultos text[] not null default '{}';
