-- ============================================================================
-- Add-on "Bloco de +10 usuários" (+R$50/mês, empilhável) — catálogo
-- ============================================================================
-- Spec: .claude/specs/addon-bloco-10-usuarios.md
-- NÃO aplicar sozinho — o coordenador roda isso com OK do dono.
--
-- Reusa 100% do trilho de add-on já construído (webhook, empresa_addons,
-- contratarAddon) — spec addon-assinatura-eletronica-zapsign.md, commit
-- c82d3be. `empresa_addons` já existe em produção e já suporta MÚLTIPLAS
-- linhas ativas por empresa (sem unique(empresa_id, addon_slug), de
-- propósito — ver comentário em 20260715100000_addon_assinatura_eletronica.sql)
-- porque este add-on é QUANTITATIVO (empilhável), diferente da assinatura
-- eletrônica (booleana). Por isso esta migration só faz upsert no catálogo —
-- nenhuma alteração de schema/RLS é necessária.
-- ============================================================================

insert into public.addons (slug, nome, descricao, preco_mensal, modulos, ativo, em_breve)
values ('bloco_10_usuarios', 'Bloco de +10 usuários',
        'Amplia o limite de usuários do seu plano em 10, por bloco. Empilhável.',
        50, '{}', true, false)
on conflict (slug) do update
  set nome=excluded.nome, descricao=excluded.descricao, preco_mensal=50,
      ativo=true, em_breve=false;

notify pgrst, 'reload schema';
