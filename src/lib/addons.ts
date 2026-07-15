/**
 * addons.ts — Catálogo TS de ADD-ONS (independente do plano).
 *
 * Sem `server-only` de propósito (mesmo padrão de src/lib/planos.ts): estas
 * constantes são exibidas em client components (banner do Dashboard, card de
 * Configurações, CTA de upsell em contratos-view.tsx) — não são segredo,
 * só preço/rótulo pra tela. A lógica que PRECISA de service role (posse,
 * webhook) mora em src/lib/addons-server.ts, com `server-only`.
 *
 * Um add-on é uma compra avulsa e recorrente, em cima do plano — ex.: a
 * assinatura eletrônica de contratos (R$49/mês). Mesmo princípio de
 * src/lib/planos.ts: preço NUNCA cobrado a partir do banco/form, só daqui
 * (evita divergir do que foi realmente configurado no Checkout).
 *
 * Desenhado para ser SLUG-AGNÓSTICO (spec addon-assinatura-eletronica-zapsign.md):
 * o PRÓXIMO add-on (bloco de usuários) só precisa de uma entrada nova em
 * PRECO_ADDON/NOME_ADDON — nem o webhook (processarWebhookAddon) nem a Server
 * Action de compra (contratarAddon, em configuracoes/actions.ts) mudam.
 */

export const ADDON_ASSINATURA = 'assinatura_eletronica'
export const ADDON_BLOCO_USUARIOS = 'bloco_10_usuarios'

/**
 * Add-ons QUANTITATIVOS (múltiplas linhas ativas por empresa) — contratarAddon
 * (configuracoes/actions.ts) pula o guard de "já ativo" pra esses slugs: o
 * objetivo é justamente permitir comprar o MESMO slug várias vezes (spec
 * addon-bloco-10-usuarios.md). Todo add-on NÃO listado aqui é booleano
 * (comprar 2x = erro "já está ativo na sua conta").
 */
export const ADDONS_EMPILHAVEIS: readonly string[] = [ADDON_BLOCO_USUARIOS]

/** Preço mensal em reais por slug — fonte única cobrada no Checkout (nunca form/DB). */
export const PRECO_ADDON: Record<string, number> = {
  [ADDON_ASSINATURA]: 49,
  [ADDON_BLOCO_USUARIOS]: 50,
}

/** Nome curto por slug — usado na descrição do item no Checkout Asaas. */
export const NOME_ADDON: Record<string, string> = {
  [ADDON_ASSINATURA]: 'Assinatura Eletrônica',
  [ADDON_BLOCO_USUARIOS]: 'Bloco de +10 usuários',
}
