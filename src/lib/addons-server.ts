import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { PRECO_ADDON } from '@/lib/addons'

/**
 * addons-server.ts — Posse de add-on (temAddon) e processamento do trilho de
 * add-on no webhook do Asaas. Separado de src/lib/addons.ts (catálogo de
 * constantes, sem `server-only`) porque estas funções recebem/assumem um
 * client admin (service role) e não fazem sentido — nem devem ser possíveis
 * de importar — a partir de um client component (ver contratos-view.tsx,
 * addon-assinatura-banner.tsx, addon-assinatura-card.tsx: todos importam só
 * as constantes de src/lib/addons.ts).
 */

/**
 * True se a empresa pode USAR o add-on agora.
 *
 * - 'ativo' e 'atrasado' liberam — um atraso de R$49 não corta o acesso no
 *   primeiro atraso (desproporcional; o dunning do plano principal já existe).
 * - Cortesia: empresas no plano 'interno' (Aurumtax) sempre podem, sem precisar
 *   de linha em empresa_addons.
 * - Fail-closed: qualquer erro de leitura devolve false — nunca libera às cegas.
 *
 * @param db        client admin (service role, bypassa RLS). A policy de
 *                  select de empresa_addons também permite a própria empresa
 *                  via client de sessão, mas os callers atuais sempre têm um
 *                  admin client à mão (ver enviarParaAssinatura).
 * @param empresaId tenant a checar.
 * @param slug      slug do add-on (ex.: ADDON_ASSINATURA).
 */
export async function temAddon(
  db: ReturnType<typeof createAdminClient>,
  empresaId: string,
  slug: string,
): Promise<boolean> {
  const { data: empresa, error: empresaErr } = await db
    .from('empresas')
    .select('plano')
    .eq('id', empresaId)
    .maybeSingle()

  if (empresaErr) {
    console.error('[temAddon] erro ao ler plano da empresa:', empresaErr.message)
    return false
  }
  if (empresa?.plano === 'interno') return true

  const { data, error } = await db
    .from('empresa_addons')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('addon_slug', slug)
    .in('status', ['ativo', 'atrasado'])
    .limit(1)

  if (error) {
    console.error('[temAddon] erro ao checar posse do add-on:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Webhook — trilho de add-on (chamado por src/app/api/asaas/webhook/route.ts)
// ---------------------------------------------------------------------------

/**
 * Faz parse de `addon:${slug}:${empresaId}` (externalReference usado por
 * contratarAddon/createCheckout). Usado pelo webhook para DETECTAR que um
 * evento pertence ao trilho de add-on (nunca ao de plano) e para resolver
 * slug+empresa sem precisar hardcodar nenhum slug específico.
 */
export function parseAddonExternalReference(ref: string): { slug: string; empresaId: string } | null {
  const PREFIXO = 'addon:'
  if (!ref.startsWith(PREFIXO)) return null

  const resto = ref.slice(PREFIXO.length)
  const sep = resto.lastIndexOf(':')
  if (sep === -1) return null

  const slug = resto.slice(0, sep)
  const empresaId = resto.slice(sep + 1)
  if (!slug || !empresaId) return null

  return { slug, empresaId }
}

/**
 * Processa um evento de webhook do Asaas do TRILHO DE ADD-ON — o caller
 * (src/app/api/asaas/webhook/route.ts) já detectou isso e SEMPRE retorna logo
 * em seguida, sem cair no fluxo de plano.
 *
 * Slug-agnóstico: `slug`/`empresaId` vêm de parseAddonExternalReference (ou do
 * lookup por asaas_subscription_id, quando o evento é de PAGAMENTO e não traz
 * a externalReference da subscription) — nada aqui é específico da assinatura
 * eletrônica. O PRÓXIMO add-on reusa esta função sem alteração.
 *
 * Idempotência: `asaas_subscription_id` é UNIQUE em `empresa_addons` — um
 * replay de SUBSCRIPTION_CREATED colide (23505) e vira no-op SILENCIOSO.
 * Diferente do fluxo de plano, NUNCA cancela nada no Asaas nesse conflito: a
 * lógica de "cancelar subscription órfã" do plano depende de UMA linha ativa
 * por empresa (UNIQUE (empresa_id) WHERE status<>'cancelado'), invariante que
 * add-ons quantitativos (bloco de usuários) não têm.
 *
 * NUNCA toca `assinaturas`, `empresas.status` ou `empresas.plano` — nem em
 * PAYMENT_OVERDUE (um atraso de R$49 não pode suspender a empresa inteira).
 *
 * PROPAGA falha em vez de engolir (revisão adversarial 2026-07-15, ALTO): uma
 * falha transitória de banco no INSERT/UPDATE não pode virar um `processed:
 * true` silencioso no caller — isso cobraria o cliente (a subscription no
 * Asaas já existe) e negaria o acesso ao add-on pra sempre, sem log de erro,
 * sem alerta, e sem chance de retry (o Asaas não reenvia um evento que já
 * recebeu 200). O caller (webhook/route.ts) espelha o padrão já usado no
 * fluxo de plano para o mesmo tipo de falha: NÃO marca processed, grava
 * `eventos_webhook.error`, dispara sendAlertaInterno, e devolve 500.
 * 23505 (replay do mesmo evento) É sucesso — não é propagado como falha.
 */
export async function processarWebhookAddon(params: {
  db: ReturnType<typeof createAdminClient>
  event: string
  slug: string
  empresaId: string
  subscriptionId: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { db, event, slug, empresaId, subscriptionId } = params

  if (event === 'SUBSCRIPTION_CREATED') {
    if (!subscriptionId) return { ok: true }
    const { error } = await db.from('empresa_addons').insert({
      empresa_id:             empresaId,
      addon_slug:             slug,
      status:                 'ativo',
      asaas_subscription_id:  subscriptionId,
      valor:                  PRECO_ADDON[slug] ?? 0,
    })
    if (error && error.code !== '23505') {
      return { ok: false, error: `insert empresa_addons: ${error.message}` }
    }

    // Limpa o placeholder de claim (status='cancelado', sentinel
    // `pending:${slug}:${empresaId}` — ver contratarAddon em
    // configuracoes/actions.ts) agora que a linha REAL já existe (inserida
    // acima, ou já existente no replay 23505). Best-effort de propósito
    // (diferente do insert acima): não bloqueia nada se falhar — o placeholder
    // nunca conta como ativo (temAddon), só sobraria como debris inofensivo na
    // tabela. Não propagado como falha.
    const { error: cleanupErr } = await db
      .from('empresa_addons')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('addon_slug', slug)
      .eq('status', 'cancelado')
      .like('asaas_subscription_id', 'pending:%')
    if (cleanupErr) {
      console.error('[processarWebhookAddon] erro ao limpar placeholder de claim:', cleanupErr.message)
    }
    return { ok: true }
  }

  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    if (!subscriptionId) return { ok: true }
    const { error } = await db
      .from('empresa_addons')
      .update({ status: 'ativo', updated_at: new Date().toISOString() })
      .eq('asaas_subscription_id', subscriptionId)
    if (error) return { ok: false, error: `ativar empresa_addons: ${error.message}` }
    return { ok: true }
  }

  if (event === 'PAYMENT_OVERDUE') {
    if (!subscriptionId) return { ok: true }
    const { error } = await db
      .from('empresa_addons')
      .update({ status: 'atrasado', updated_at: new Date().toISOString() })
      .eq('asaas_subscription_id', subscriptionId)
    if (error) return { ok: false, error: `marcar atrasado empresa_addons: ${error.message}` }
    return { ok: true }
  }

  if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_CANCELLED' || event === 'SUBSCRIPTION_INACTIVATED') {
    if (!subscriptionId) return { ok: true }
    const { error } = await db
      .from('empresa_addons')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('asaas_subscription_id', subscriptionId)
    if (error) return { ok: false, error: `cancelar empresa_addons: ${error.message}` }
    return { ok: true }
  }

  // Outros eventos (ex.: PAYMENT_REFUNDED, CHARGEBACK) — sem efeito conhecido
  // no trilho de add-on hoje; ignorado silenciosamente (não é erro).
  return { ok: true }
}
