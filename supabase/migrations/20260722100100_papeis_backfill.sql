-- ============================================================================
-- CRM Studio — Papéis customizáveis por empresa (Fase 1: backfill)
-- ============================================================================
-- Spec: .claude/specs/papeis-customizaveis-01-fundacao.md
--
-- Idempotente: `on conflict (empresa_id, role_sistema) do nothing` nos papéis
-- e `where papel_id is null` no update de profiles — rodar esta migration mais
-- de uma vez não duplica papéis nem sobrescreve nomes já customizados pelo
-- admin (é exatamente o objetivo do ON CONFLICT DO NOTHING: reentrada segura).
-- ============================================================================

-- 1) Cria os 4 papéis de sistema pra TODA empresa existente — mesmo que ela
--    ainda não tenha nenhum profile com aquele role (ex.: empresa sem sócio
--    hoje já pode renomear o papel "Sócio" agora, valendo pro convite futuro).
insert into public.papeis (empresa_id, nome, role_sistema, sistema)
select e.id, v.nome, v.role_sistema, true
from public.empresas e
cross join (values
  ('Administrador', 'admin'),
  ('Sócio',         'socio'),
  ('Comercial',     'comercial'),
  ('Parceiro',      'parceiro')
) as v(nome, role_sistema)
on conflict (empresa_id, role_sistema) do nothing;

-- 2) Associa cada profile existente ao papel de sistema correspondente ao seu
--    role atual — só onde papel_id ainda estiver vazio (não sobrescreve
--    atribuição manual futura) e só quando o profile tiver empresa (conta
--    órfã sem empresa_id não tem de qual empresa puxar o papel).
update public.profiles p
set papel_id = pa.id
from public.papeis pa
where pa.empresa_id = p.empresa_id
  and pa.role_sistema = p.role
  and p.papel_id is null
  and p.empresa_id is not null;

NOTIFY pgrst, 'reload schema';
