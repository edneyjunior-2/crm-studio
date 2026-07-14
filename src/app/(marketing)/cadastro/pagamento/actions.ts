'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'
import { createCheckout } from '@/lib/asaas'
import { appUrl } from '@/lib/site-url'

export type IniciarCheckoutState = { error?: string; checkoutUrl?: string } | null

// Janela de "reivindicação" de um checkout em andamento. Fecha a corrida de
// duplo clique/F5 (ver invariante de segurança na spec): a 1ª chamada grava
// asaas_checkout_criado_em atomicamente (UPDATE condicional — Postgres
// serializa updates concorrentes na mesma linha, só uma vence a corrida);
// chamadas concorrentes/subsequentes dentro da janela reaproveitam o MESMO
// link de checkout em vez de criar outro no Asaas. Fora da janela (ex.:
// usuário cancelou no Asaas e voltou bem depois), libera criar um novo.
const CLAIM_TTL_MS = 5 * 60 * 1000

export async function iniciarCheckoutCartao(
  _prev: IniciarCheckoutState,
  _formData: FormData,
): Promise<IniciarCheckoutState> {
  const { empresaId, status, role } = await getAuthUser()

  if (role === 'parceiro') return { error: 'Acesso negado.' }
  if (!empresaId) return { error: 'Conta sem empresa vinculada.' }

  if (status !== 'pendente_cartao') {
    return { error: 'Sua conta já passou dessa etapa.' }
  }

  const db = createAdminClient()

  // Guard de duplo-submit "pós-webhook": se por alguma corrida o webhook já
  // processou SUBSCRIPTION_CREATED (outra aba concluiu o checkout antes desta
  // requisição), já existe assinatura — não inicia outro checkout. Mesmo
  // padrão de src/app/(conta)/assinatura/actions.ts (assinarPlano).
  const { data: assinaturaExistente } = await db
    .from('assinaturas')
    .select('id')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelado')
    .maybeSingle()

  if (assinaturaExistente) {
    return { error: 'Sua conta já possui uma assinatura ativa.' }
  }

  // Reivindicação atômica do checkout (ver comentário do CLAIM_TTL_MS acima).
  const cutoffIso = new Date(Date.now() - CLAIM_TTL_MS).toISOString()
  const { data: claim } = await db
    .from('empresas')
    .update({ asaas_checkout_criado_em: new Date().toISOString() })
    .eq('id', empresaId)
    .eq('status', 'pendente_cartao')
    .or(`asaas_checkout_criado_em.is.null,asaas_checkout_criado_em.lt.${cutoffIso}`)
    .select('id')
    .maybeSingle()

  if (!claim) {
    // Reivindicação recente já em andamento — reaproveita o checkout existente
    // em vez de retornar erro (evita "quebrar" o duplo clique/F5 pro usuário).
    const { data: atual } = await db
      .from('empresas')
      .select('asaas_checkout_url')
      .eq('id', empresaId)
      .maybeSingle()

    if (atual?.asaas_checkout_url) {
      return { checkoutUrl: atual.asaas_checkout_url }
    }
    return { error: 'Já iniciamos seu checkout há poucos instantes. Aguarde alguns segundos e tente novamente.' }
  }

  try {
    // nextDueDate = hoje + 14 dias — é quando a 1ª cobrança REAL acontece.
    // O cartão é validado (não cobrado) no ato pelo Asaas.
    const due = new Date()
    due.setDate(due.getDate() + 14)
    const nextDueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`

    const base = appUrl()
    // Sem customer/customerData: nome, CPF/CNPJ e e-mail são preenchidos pela
    // própria pessoa na página hospedada do Checkout Asaas (ver spec
    // checkout-email-unico-asaas-coleta-dados.md). O webhook faz o backfill
    // desses dados reais em `empresas` via GET /customers/{id} depois que a
    // assinatura é confirmada (SUBSCRIPTION_CREATED).
    const checkout = await createCheckout({
      empresaId,
      value: 147,
      nextDueDate,
      successUrl: `${base}/cadastro/pagamento/sucesso`,
      cancelUrl:  `${base}/cadastro/pagamento`,
      expiredUrl: `${base}/cadastro/pagamento`,
    })

    await db
      .from('empresas')
      .update({ asaas_checkout_url: checkout.link })
      .eq('id', empresaId)

    return { checkoutUrl: checkout.link }
  } catch (err) {
    // Falha na Asaas (ou no update pós-checkout) — libera a reivindicação pra
    // não travar o usuário por até 5 minutos por causa de um erro transitório.
    await db
      .from('empresas')
      .update({ asaas_checkout_criado_em: null })
      .eq('id', empresaId)

    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Erro ao iniciar o checkout: ${msg}` }
  }
}
