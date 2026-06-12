'use server'

import { revalidatePath } from 'next/cache'
import { contaPagarSchema, contaReceberSchema } from '@/lib/schemas'
import { getAuthFinanceiro } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createContaReceber(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()

  const parsed = contaReceberSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const { error } = await supabase.from('contas_receber').insert({
    descricao: formData.get('descricao') as string,
    cliente_id: formData.get('cliente_id') as string,
    negocio_id: (formData.get('negocio_id') as string) || null,
    valor: parseFloat(formData.get('valor') as string),
    moeda: (formData.get('moeda') as string) || 'BRL',
    data_vencimento: formData.get('data_vencimento') as string,
    status: (formData.get('status') as string) || 'pendente',
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function updateContaReceber(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const parsed = contaReceberSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const { error } = await supabase
    .from('contas_receber')
    .update({
      descricao: formData.get('descricao') as string,
      cliente_id: formData.get('cliente_id') as string,
      negocio_id: (formData.get('negocio_id') as string) || null,
      valor: parseFloat(formData.get('valor') as string),
      moeda: (formData.get('moeda') as string) || 'BRL',
      data_vencimento: formData.get('data_vencimento') as string,
      status: formData.get('status') as string,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function deleteContaReceber(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const { error } = await supabase.from('contas_receber').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function marcarRecebido(
  id: string,
  data_recebimento: string,
  bancoId?: string
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()

  if (bancoId) {
    const { data: conta } = await supabase
      .from('contas_receber')
      .select('descricao, valor, moeda')
      .eq('id', id)
      .single()

    if (conta) {
      const { error: movErr } = await supabase.from('movimentacoes').insert({
        banco_id: bancoId,
        tipo: 'entrada',
        valor: conta.valor,
        moeda: conta.moeda ?? 'BRL',
        descricao: conta.descricao,
        categoria: 'Receita de vendas',
        data: data_recebimento,
        conta_receber_id: id,
        created_by: user.id,
      })
      if (movErr) return { error: movErr.message }
    }
  }

  const { error } = await supabase
    .from('contas_receber')
    .update({ status: 'recebido', data_recebimento })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/financeiro/bancos')
  return {}
}

function addPeriod(baseDate: Date, frequencia: string, qty: number): Date {
  const d = new Date(baseDate)
  if (frequencia === 'semanal') {
    d.setDate(d.getDate() + qty * 7)
  } else if (frequencia === 'mensal') {
    d.setMonth(d.getMonth() + qty)
  } else if (frequencia === 'semestral') {
    d.setMonth(d.getMonth() + qty * 6)
  } else if (frequencia === 'anual') {
    d.setFullYear(d.getFullYear() + qty)
  }
  return d
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function createContaPagar(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()

  const parsed = contaPagarSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const descricao = formData.get('descricao') as string
  const fornecedor = (formData.get('fornecedor') as string) || null
  const valor = parseFloat(formData.get('valor') as string)
  const moeda = (formData.get('moeda') as string) || 'BRL'
  const dataVencimento = formData.get('data_vencimento') as string
  const categoria = (formData.get('categoria') as string) || null
  const status = (formData.get('status') as string) || 'pendente'
  const recorrente = formData.get('recorrente') === 'true'
  const frequencia = (formData.get('frequencia') as string) || null
  const recorrenteAte = (formData.get('recorrente_ate') as string) || null
  const isCartao = formData.get('is_cartao') === 'true'
  const numParcelas = parseInt((formData.get('num_parcelas') as string) || '0')
  const cartaoInfo = (formData.get('cartao_info') as string) || null

  const fornecedorId = (formData.get('fornecedor_id') as string) || null
  const pixCopaCola = (formData.get('pix_copia_cola') as string) || null
  const codigoBoleto = (formData.get('codigo_boleto') as string) || null

  if (isCartao && numParcelas >= 2) {
    const [y, m, d] = dataVencimento.split('-').map(Number)
    const base = new Date(y, m - 1, d)
    const parcelas = Array.from({ length: numParcelas }, (_, i) => {
      const parcNum = i + 1
      const venc = i === 0 ? base : addPeriod(base, 'mensal', i)
      return {
        descricao: `${descricao} (${parcNum}/${numParcelas}x)`,
        fornecedor,
        fornecedor_id: fornecedorId,
        valor: Math.round((valor / numParcelas) * 100) / 100,
        moeda,
        data_vencimento: toDateString(venc),
        categoria,
        status,
        recorrente: false,
        frequencia: null,
        is_cartao: true,
        cartao_info: cartaoInfo,
        pix_copia_cola: pixCopaCola,
        codigo_boleto: codigoBoleto,
        created_by: user.id,
      }
    })
    const { error } = await supabase.from('contas_pagar').insert(parcelas)
    if (error) return { error: error.message }
    revalidatePath('/financeiro')
    return {}
  }

  if (!recorrente || !frequencia) {
    const { error } = await supabase.from('contas_pagar').insert({
      descricao,
      fornecedor,
      fornecedor_id: fornecedorId,
      valor,
      moeda,
      data_vencimento: dataVencimento,
      categoria,
      status,
      recorrente: false,
      frequencia: null,
      is_cartao: false,
      cartao_info: null,
      pix_copia_cola: pixCopaCola,
      codigo_boleto: codigoBoleto,
      created_by: user.id,
    })
    if (error) return { error: error.message }
    revalidatePath('/financeiro')
    return {}
  }

  const [y, m, d] = dataVencimento.split('-').map(Number)
  const base = new Date(y, m - 1, d)

  function calcTotal(freq: string, ate: string | null): number {
    if (!ate) {
      const defaultMap: Record<string, number> = { semanal: 52, mensal: 12, semestral: 2, anual: 2 }
      return defaultMap[freq] ?? 12
    }
    const [ey, em, ed] = ate.split('-').map(Number)
    const end = new Date(ey, em - 1, ed)
    let count = 0
    let cur = new Date(base)
    while (cur <= end && count < 600) {
      count++
      cur = addPeriod(base, freq, count)
    }
    return Math.max(1, count)
  }

  const total = calcTotal(frequencia, recorrenteAte)

  const parcelas = Array.from({ length: total }, (_, i) => {
    const parcNum = i + 1
    const venc = i === 0 ? base : addPeriod(base, frequencia, i)
    return {
      descricao: `${descricao} (${parcNum}/${total})`,
      fornecedor,
      fornecedor_id: fornecedorId,
      valor,
      moeda,
      data_vencimento: toDateString(venc),
      categoria,
      status,
      recorrente: true,
      frequencia,
      is_cartao: false,
      cartao_info: null,
      pix_copia_cola: pixCopaCola,
      codigo_boleto: codigoBoleto,
      created_by: user.id,
    }
  })

  const { error } = await supabase.from('contas_pagar').insert(parcelas)
  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function updateContaPagar(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const parsed = contaPagarSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const recorrente = formData.get('recorrente') === 'true'
  const frequencia = (formData.get('frequencia') as string) || null

  const { error } = await supabase
    .from('contas_pagar')
    .update({
      descricao: formData.get('descricao') as string,
      fornecedor: (formData.get('fornecedor') as string) || null,
      fornecedor_id: (formData.get('fornecedor_id') as string) || null,
      valor: parseFloat(formData.get('valor') as string),
      moeda: (formData.get('moeda') as string) || 'BRL',
      data_vencimento: formData.get('data_vencimento') as string,
      categoria: (formData.get('categoria') as string) || null,
      status: formData.get('status') as string,
      recorrente,
      frequencia: recorrente ? frequencia : null,
      cartao_info: (formData.get('cartao_info') as string) || null,
      pix_copia_cola: (formData.get('pix_copia_cola') as string) || null,
      codigo_boleto: (formData.get('codigo_boleto') as string) || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function deleteContaPagar(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthFinanceiro()

  const { error } = await supabase.from('contas_pagar').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  return {}
}

export async function uploadComprovante(
  contaId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const supabase = await getAuthFinanceiro()
  const { user } = supabase

  const file = formData.get('comprovante') as File | null
  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado' }

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) return { error: 'Arquivo muito grande. Máximo 10MB.' }

  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
  if (!ext || !allowed.includes(ext)) return { error: 'Formato inválido. Use JPG, PNG, WebP ou PDF.' }

  const fileName = `${user.id}/${contaId}.${ext}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('comprovantes')
    .upload(fileName, file, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = admin.storage.from('comprovantes').getPublicUrl(fileName)

  const { error: updateError } = await admin
    .from('contas_pagar')
    .update({ comprovante_url: publicUrl })
    .eq('id', contaId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/financeiro')
  return { url: publicUrl }
}

export async function marcarPago(
  id: string,
  data_pagamento: string,
  bancoId?: string,
  multa?: number,
  juros?: number
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthFinanceiro()

  const multaVal = multa ?? 0
  const jurosVal = juros ?? 0

  let valorBase: number | null = null

  if (bancoId) {
    const { data: conta } = await supabase
      .from('contas_pagar')
      .select('descricao, valor, moeda, fornecedor, categoria')
      .eq('id', id)
      .single()

    if (conta) {
      valorBase = Number(conta.valor)
      const valorReal = valorBase + multaVal + jurosVal
      const descricaoMov = multaVal + jurosVal > 0
        ? `${conta.descricao} (+ multa/juros)`
        : conta.descricao

      const { error: movErr } = await supabase.from('movimentacoes').insert({
        banco_id: bancoId,
        tipo: 'saida',
        valor: valorReal,
        moeda: conta.moeda ?? 'BRL',
        descricao: descricaoMov,
        categoria: conta.categoria ?? 'Fornecedores',
        destino_origem: conta.fornecedor ?? null,
        data: data_pagamento,
        conta_pagar_id: id,
        created_by: user.id,
      })
      if (movErr) return { error: movErr.message }
    }
  }

  if (valorBase === null) {
    const { data: contaAtual } = await supabase
      .from('contas_pagar')
      .select('valor')
      .eq('id', id)
      .single()

    valorBase = contaAtual ? Number(contaAtual.valor) : null
  }

  const valorPago = valorBase !== null ? valorBase + multaVal + jurosVal : null

  const { error } = await supabase
    .from('contas_pagar')
    .update({
      status: 'pago',
      data_pagamento,
      valor_pago: valorPago,
      multa: multaVal,
      juros: jurosVal,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/financeiro/bancos')
  return {}
}
