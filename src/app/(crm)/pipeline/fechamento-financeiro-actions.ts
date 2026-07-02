'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface GerarFinanceiroOpts {
  /** Negócio recém-fechado */
  negocioId: string
  /** Data de fechamento no formato YYYY-MM-DD */
  dataFechamento: string
  /** Periodicidade do contrato */
  periodicidade: string
}

interface GerarFinanceiroResult {
  error?: string
  contaReceberId?: string
  comissaoId?: string
  /** Mensagem amigável descrevendo o que foi gerado */
  mensagem?: string
}

interface FinanceiroNegocioResult {
  error?: string
  /** Aviso não-bloqueante (ex.: havia registro já liquidado que foi preservado) */
  aviso?: string
}

/**
 * Calcula o valor de comissão de um negócio somando produto a produto (cada
 * produto tem sua própria solução e percentual). Fallback para negócios
 * antigos sem produtos: usa solucao_id + valor_estimado do negócio.
 *
 * Compartilhado entre a geração no fechamento e a ressincronização após
 * edição de valor — mesma regra de cálculo nos dois lugares.
 */
async function calcularValorComissao(
  supabase: SupabaseServerClient,
  negocio: { id: string; solucao_id: string | null; valor_estimado: number | null }
): Promise<number> {
  let valorComissao = 0

  const { data: produtos } = await supabase
    .from('negocio_produtos')
    .select('solucao_id, valor')
    .eq('negocio_id', negocio.id)

  if (produtos && produtos.length > 0) {
    // Busca percentuais de todas as soluções referenciadas nos produtos
    const solucaoIds = [...new Set(produtos.map((p) => p.solucao_id).filter(Boolean))] as string[]
    const { data: solucoes } = solucaoIds.length > 0
      ? await supabase
          .from('solucoes')
          .select('id, comissao_percentual')
          .in('id', solucaoIds)
      : { data: [] }

    const mapaPercentual = new Map(
      (solucoes ?? []).map((s) => [s.id, s.comissao_percentual ?? 0])
    )

    for (const produto of produtos) {
      const pct = produto.solucao_id ? (mapaPercentual.get(produto.solucao_id) ?? 0) : 0
      if (pct > 0 && produto.valor) {
        valorComissao += (produto.valor * pct) / 100
      }
    }
  } else if (negocio.solucao_id && negocio.valor_estimado) {
    // Fallback: negócio sem produtos — comportamento original
    const { data: solucao } = await supabase
      .from('solucoes')
      .select('comissao_percentual')
      .eq('id', negocio.solucao_id)
      .maybeSingle()

    const percentual = solucao?.comissao_percentual ?? 0
    if (percentual > 0) {
      valorComissao = (negocio.valor_estimado * percentual) / 100
    }
  }

  return Number(valorComissao.toFixed(2))
}

/**
 * Gera (de forma idempotente) uma conta a receber e uma comissão prevista
 * para um negócio fechado como ganho.
 *
 * Idempotência: verifica se já existe conta/comissão vinculada ao negocio_id
 * antes de inserir. Chamadas duplicadas não criam registros repetidos.
 */
export async function gerarFinanceiroDoFechamento(
  opts: GerarFinanceiroOpts
): Promise<GerarFinanceiroResult> {
  const { negocioId, dataFechamento, periodicidade } = opts

  const { supabase, empresaId, user } = await getAuthUser()

  if (!empresaId) return { error: 'Empresa não identificada.' }

  // --- Buscar negócio com solução (para comissao_percentual) ---
  const { data: negocio, error: negocioErr } = await supabase
    .from('negocios')
    .select('id, titulo, cliente_id, solucao_id, responsavel_id, valor_estimado')
    .eq('id', negocioId)
    .single()

  if (negocioErr || !negocio) {
    return { error: negocioErr?.message ?? 'Negócio não encontrado.' }
  }

  // Calcula data de vencimento:
  // mensal → +1 mês com clamp no último dia do mês destino, demais → própria data de fechamento
  function calcVencimento(base: string, periodo: string): string {
    const [ano, mes, dia] = base.split('-').map(Number)
    if (periodo === 'mensal') {
      // Avança o mês (mes é 1-based; Date(ano, mes, 0) dá o último dia do mês-alvo)
      const mesAlvo = mes === 12 ? 1 : mes + 1
      const anoAlvo = mes === 12 ? ano + 1 : ano
      const ultimoDia = new Date(anoAlvo, mesAlvo, 0).getDate() // último dia do mês alvo
      const diaFinal = Math.min(dia, ultimoDia)
      return `${anoAlvo}-${String(mesAlvo).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`
    }
    return base
  }

  const dataVencimento = calcVencimento(dataFechamento, periodicidade)
  const gerados: string[] = []

  // ----------------------------------------------------------------
  // 1. Conta a Receber — idempotente por negocio_id
  // ----------------------------------------------------------------
  let contaReceberId: string | undefined

  const { data: contaExistente } = await supabase
    .from('contas_receber')
    .select('id')
    .eq('negocio_id', negocioId)
    .maybeSingle()

  if (!contaExistente) {
    const valorReceber = negocio.valor_estimado ?? 0
    if (valorReceber > 0) {
      const { data: novaConta, error: contaErr } = await supabase
        .from('contas_receber')
        .insert({
          negocio_id: negocioId,
          cliente_id: negocio.cliente_id,
          descricao: `Recebível — ${negocio.titulo}`,
          valor: valorReceber,
          data_vencimento: dataVencimento,
          status: 'pendente',
          created_by: user.id,
          empresa_id: empresaId,
        })
        .select('id')
        .single()

      if (contaErr) return { error: `Erro ao criar conta a receber: ${contaErr.message}` }
      contaReceberId = novaConta.id
      gerados.push('conta a receber')
    }
  } else {
    contaReceberId = contaExistente.id
  }

  // ----------------------------------------------------------------
  // 2. Comissão prevista — idempotente por negocio_id
  // ----------------------------------------------------------------
  let comissaoId: string | undefined

  const valorComissao = await calcularValorComissao(supabase, negocio)

  if (valorComissao > 0) {
    const { data: comissaoExistente } = await supabase
      .from('comissoes_comercial')
      .select('id')
      .eq('negocio_id', negocioId)
      .maybeSingle()

    if (!comissaoExistente) {
      const { data: novaComissao, error: comissaoErr } = await supabase
        .from('comissoes_comercial')
        .insert({
          negocio_id: negocioId,
          comercial_id: negocio.responsavel_id,
          descricao: `Comissão — ${negocio.titulo}`,
          valor: valorComissao,
          data_previsao: dataFechamento,
          status: 'previsto',
          created_by: user.id,
          empresa_id: empresaId,
        })
        .select('id')
        .single()

      if (comissaoErr) return { error: `Erro ao criar comissão: ${comissaoErr.message}` }
      comissaoId = novaComissao.id
      gerados.push('comissão prevista')
    } else {
      comissaoId = comissaoExistente.id
    }
  }

  revalidatePath('/financeiro')
  revalidatePath('/pipeline')

  const mensagem =
    gerados.length > 0
      ? `Gerado: ${gerados.join(' e ')}.`
      : 'Registros financeiros já existiam — nenhum duplicado criado.'

  return { contaReceberId, comissaoId, mensagem }
}

/**
 * Estorna o financeiro gerado no fechamento de um negócio que deixou de
 * estar "ganho" (reaberto ou movido para uma etapa perdida).
 *
 * Só toca registros ainda NÃO liquidados: deleta a conta a receber com
 * status 'pendente' e a comissão com status 'previsto' vinculadas ao
 * negócio. Se já existir conta 'recebido' ou comissão 'pago', o registro é
 * preservado e um aviso é retornado — nunca apagamos financeiro liquidado.
 */
export async function estornarFinanceiroDoNegocio(
  negocioId: string
): Promise<FinanceiroNegocioResult> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não identificada.' }

  const avisos: string[] = []

  // --- Conta a receber: apaga só a NÃO liquidada (pendente/atrasado); recebida
  //     fica intacta. A condição de status vai NO PRÓPRIO DELETE (não em JS) para
  //     não haver janela entre ler e apagar — se o financeiro liquidar a conta
  //     entre o SELECT e o DELETE, o WHERE status protege o dinheiro recebido. ---
  const { data: contas, error: contasErr } = await supabase
    .from('contas_receber')
    .select('status')
    .eq('negocio_id', negocioId)

  if (contasErr) return { error: `Erro ao consultar conta a receber: ${contasErr.message}` }

  if ((contas ?? []).some((c) => c.status === 'recebido')) {
    avisos.push('conta a receber já recebida foi mantida')
  }
  const { error: delContaErr } = await supabase
    .from('contas_receber')
    .delete()
    .eq('negocio_id', negocioId)
    .in('status', ['pendente', 'atrasado'])
  if (delContaErr) return { error: `Erro ao estornar conta a receber: ${delContaErr.message}` }

  // --- Comissão: apaga só a prevista; paga fica intacta (condição no DELETE). ---
  const { data: comissoes, error: comissoesErr } = await supabase
    .from('comissoes_comercial')
    .select('status')
    .eq('negocio_id', negocioId)

  if (comissoesErr) return { error: `Erro ao consultar comissão: ${comissoesErr.message}` }

  if ((comissoes ?? []).some((c) => c.status === 'pago')) {
    avisos.push('comissão já paga foi mantida')
  }
  const { error: delComissaoErr } = await supabase
    .from('comissoes_comercial')
    .delete()
    .eq('negocio_id', negocioId)
    .eq('status', 'previsto')
  if (delComissaoErr) return { error: `Erro ao estornar comissão: ${delComissaoErr.message}` }

  revalidatePath('/financeiro')
  revalidatePath('/pipeline')
  revalidatePath('/pipeline/historico-perdidos')

  return avisos.length > 0 ? { aviso: avisos.join('; ') } : {}
}

/**
 * Ressincroniza a conta a receber ('pendente') e a comissão ('previsto') já
 * geradas no fechamento de um negócio "ganho" cujo valor_estimado (ou
 * composição de produtos) mudou após uma edição.
 *
 * Regra igual à de `gerarFinanceiroDoFechamento`: recalcula a comissão
 * produto a produto (com fallback para solucao_id do negócio). Só atualiza
 * registros NÃO liquidados — conta 'recebido' e comissão 'pago' nunca são
 * tocadas. Se o novo valor calculado zerar, o registro pendente/previsto é
 * removido (mesma regra de "só cria se > 0" do fechamento). Não cria
 * conta/comissão que não existia antes — isso é responsabilidade exclusiva
 * do fechamento.
 */
export async function sincronizarFinanceiroDoNegocio(
  negocioId: string
): Promise<FinanceiroNegocioResult> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não identificada.' }

  const { data: negocio, error: negocioErr } = await supabase
    .from('negocios')
    .select('id, solucao_id, valor_estimado')
    .eq('id', negocioId)
    .single()

  if (negocioErr || !negocio) {
    return { error: negocioErr?.message ?? 'Negócio não encontrado.' }
  }

  const avisos: string[] = []

  // --- Conta a receber NÃO liquidada (pendente/atrasado) → ressincroniza valor.
  //     Um negócio pode ter conta MANUAL além da do fechamento; se houver mais de
  //     uma não-liquidada não dá p/ saber qual é a do fechamento, então pula com
  //     aviso (nunca clobbera uma conta manual). Recebida nunca é tocada, e a
  //     condição de status vai na própria mutação (à prova de corrida). ---
  const { data: contas, error: contaErr } = await supabase
    .from('contas_receber')
    .select('id, status')
    .eq('negocio_id', negocioId)

  if (contaErr) return { error: `Erro ao consultar conta a receber: ${contaErr.message}` }

  const contasNaoLiquidadas = (contas ?? []).filter(
    (c) => c.status === 'pendente' || c.status === 'atrasado'
  )
  if (contasNaoLiquidadas.length > 1) {
    avisos.push('múltiplas contas a receber vinculadas — valor não ressincronizado automaticamente')
  } else if (contasNaoLiquidadas.length === 1) {
    const conta = contasNaoLiquidadas[0]
    const novoValor = negocio.valor_estimado ?? 0
    if (novoValor > 0) {
      const { error: updContaErr } = await supabase
        .from('contas_receber')
        .update({ valor: novoValor })
        .eq('id', conta.id)
        .in('status', ['pendente', 'atrasado'])
      if (updContaErr) return { error: `Erro ao ressincronizar conta a receber: ${updContaErr.message}` }
    } else {
      // Valor zerou: não há mais recebível — remove a não-liquidada (nunca a liquidada).
      const { error: delContaErr } = await supabase
        .from('contas_receber')
        .delete()
        .eq('id', conta.id)
        .in('status', ['pendente', 'atrasado'])
      if (delContaErr) return { error: `Erro ao remover conta a receber zerada: ${delContaErr.message}` }
    }
  } else if ((contas ?? []).some((c) => c.status === 'recebido')) {
    avisos.push('conta a receber já liquidada foi mantida com o valor antigo')
  }

  // --- Comissão prevista → recalcula pelos produtos/solução; paga fica intacta.
  //     Mesma regra de "mais de uma → pula" e condição de status na mutação. ---
  const { data: comissoesData, error: comissaoErr } = await supabase
    .from('comissoes_comercial')
    .select('id, status')
    .eq('negocio_id', negocioId)

  if (comissaoErr) return { error: `Erro ao consultar comissão: ${comissaoErr.message}` }

  const comissoesPrevistas = (comissoesData ?? []).filter((c) => c.status === 'previsto')
  if (comissoesPrevistas.length > 1) {
    avisos.push('múltiplas comissões vinculadas — valor não ressincronizado automaticamente')
  } else if (comissoesPrevistas.length === 1) {
    const comissao = comissoesPrevistas[0]
    const novoValorComissao = await calcularValorComissao(supabase, negocio)
    if (novoValorComissao > 0) {
      const { error: updComissaoErr } = await supabase
        .from('comissoes_comercial')
        .update({ valor: novoValorComissao })
        .eq('id', comissao.id)
        .eq('status', 'previsto')
      if (updComissaoErr) return { error: `Erro ao ressincronizar comissão: ${updComissaoErr.message}` }
    } else {
      // Recalculo zerou (ex.: solução sem comissão): remove a prevista (nunca a paga).
      const { error: delComissaoErr } = await supabase
        .from('comissoes_comercial')
        .delete()
        .eq('id', comissao.id)
        .eq('status', 'previsto')
      if (delComissaoErr) return { error: `Erro ao remover comissão zerada: ${delComissaoErr.message}` }
    }
  } else if ((comissoesData ?? []).some((c) => c.status === 'pago')) {
    avisos.push('comissão já liquidada foi mantida com o valor antigo')
  }

  revalidatePath('/financeiro')
  revalidatePath('/pipeline')

  return avisos.length > 0 ? { aviso: avisos.join('; ') } : {}
}
