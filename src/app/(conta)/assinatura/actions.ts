'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'
import { createCustomer, createSubscription, cancelSubscription } from '@/lib/asaas'

const planoSchema = z.enum(['starter', 'pro', 'business'])

export type AssinarPlanoState = { error?: string; success?: boolean } | null

export async function assinarPlano(
  _prev: AssinarPlanoState,
  formData: FormData,
): Promise<AssinarPlanoState> {
  const { user, empresaId, status } = await getAuthUser()

  if (!empresaId) return { error: 'Conta sem empresa vinculada.' }

  // Apenas empresas em trial, suspenso ou cancelado podem assinar aqui
  if (!['trial', 'suspenso', 'cancelado'].includes(status)) {
    return { error: 'Sua conta já possui uma assinatura ativa ou em processamento.' }
  }

  const planoRaw = formData.get('plano') as string
  const cnpj = (formData.get('cnpj') as string)?.trim() || undefined

  const planoResult = planoSchema.safeParse(planoRaw)
  if (!planoResult.success) return { error: 'Selecione um plano válido.' }
  const plano = planoResult.data

  const db = createAdminClient()

  // Busca dados da empresa (nome + asaas_customer_id existente)
  const { data: empresa } = await db
    .from('empresas')
    .select('nome, asaas_customer_id')
    .eq('id', empresaId)
    .single()

  if (!empresa) return { error: 'Empresa não encontrada.' }

  // (a) Guard de duplo-submit: verifica se já existe assinatura não-cancelada
  //     antes de tocar no Asaas. Evita criar duas subscriptions cobrando a empresa.
  const { data: assinaturaExistente } = await db
    .from('assinaturas')
    .select('id')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelado')
    .maybeSingle()

  if (assinaturaExistente) {
    return { error: 'Sua conta já possui uma assinatura ativa.' }
  }

  const email = user.email ?? ''

  try {
    let customerId = empresa.asaas_customer_id as string | null

    // Cria customer no Asaas somente se ainda não existir
    if (!customerId) {
      const customer = await createCustomer(empresaId, empresa.nome, email, cnpj)
      customerId = customer.id

      await db
        .from('empresas')
        .update({ asaas_customer_id: customerId })
        .eq('id', empresaId)
    }

    // nextDueDate = hoje + 3 dias (prazo para o cliente efetuar o pagamento)
    const due = new Date()
    due.setDate(due.getDate() + 3)
    const nextDueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`

    // Cria subscription — Asaas envia e-mail automático com link de pagamento
    const subscription = await createSubscription(customerId, plano, nextDueDate)

    // Atualiza empresa: pendente, zera trial_ends_at
    await db
      .from('empresas')
      .update({
        status:        'pendente',
        plano,
        trial_ends_at: null,
      })
      .eq('id', empresaId)

    // Registra assinatura localmente.
    // (b) Se o insert falhar com 23505 (UNIQUE empresaId + status<>'cancelado'),
    //     significa que outra requisição concurrent criou a subscription primeiro.
    //     Nesse caso cancelamos a subscription órfã que acabamos de criar no Asaas
    //     (best-effort) para não cobrar duas vezes a empresa.
    const { error: insertErr } = await db.from('assinaturas').insert({
      empresa_id:            empresaId,
      plano,
      asaas_subscription_id: subscription.id,
      status:                'pendente',
      billing_type:          subscription.billingType,
      cycle:                 'MONTHLY',
      value:                 subscription.value,
    })

    if (insertErr) {
      if (insertErr.code === '23505') {
        // Rollback best-effort: cancela a subscription órfã no Asaas
        cancelSubscription(subscription.id).catch((e: unknown) => {
          console.error('[assinarPlano] falha ao cancelar subscription órfã no Asaas:', e)
        })
        return { error: 'Sua conta já possui uma assinatura ativa.' }
      }
      throw new Error(insertErr.message)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Erro ao processar assinatura: ${msg}` }
  }

  revalidatePath('/assinatura')
  return { success: true }
}
