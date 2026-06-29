-- Expõe email + last_sign_in_at de auth.users, por profile, via uma view em
-- public RESTRITA ao service_role. Motivo: a tela de Usuários (Configurações)
-- lia esses dados via auth.admin.listUsers() (API GoTrue), que vinha falhando
-- silenciosamente em produção e deixava TODOS os e-mails vazios ("—"). Lendo
-- direto do banco (PostgREST, que funciona com a service key), fica robusto.
--
-- Segurança: a view roda com privilégio do owner (postgres) p/ ler auth.users,
-- mas o acesso via API é revogado de anon/authenticated e concedido só ao
-- service_role (usado apenas pelo admin client, server-side). E-mails NÃO ficam
-- expostos publicamente.

create or replace view public.profiles_auth as
select p.id, u.email, u.last_sign_in_at
from public.profiles p
join auth.users u on u.id = p.id;

revoke all on public.profiles_auth from anon, authenticated;
grant select on public.profiles_auth to service_role;

notify pgrst, 'reload schema';
