-- =============================================================================
-- Corrige a FK de responsavel_id para apontar a profiles(id) em vez de auth.users.
--
-- A página /parceiros e clientes/actions.ts usam o embed do PostgREST
-- `profiles!responsavel_id(full_name)`. Esse embed SÓ resolve se existir uma
-- relação direta (parceiros|clientes) -> profiles. Com a FK apontando para
-- auth.users, o PostgREST retorna PGRST200 ("could not find relationship") e a
-- página quebra com "Erro ao carregar parceiros".
--
-- profiles.id == auth.users.id (1-1), então trocar o alvo da FK é seguro:
-- todos os responsavel_id existentes já são profiles válidos.
-- =============================================================================

ALTER TABLE public.parceiros DROP CONSTRAINT IF EXISTS parceiros_responsavel_id_fkey;
ALTER TABLE public.parceiros
  ADD CONSTRAINT parceiros_responsavel_id_fkey
  FOREIGN KEY (responsavel_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_responsavel_id_fkey;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_responsavel_id_fkey
  FOREIGN KEY (responsavel_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
