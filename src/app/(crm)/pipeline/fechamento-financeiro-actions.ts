'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

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

  // Calcula comissão somando produto a produto (cada produto tem sua própria solução e %)
  // Fallback para negócios antigos sem produtos: usa solucao_id + valor_estimado do negócio.
  let valorComissao = 0

  const { data: produtos } = await supabase
    .from('negocio_produtos')
    .select('solucao_id, valor')
    .eq('negocio_id', negocioId)

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

  valorComissao = Number(valorComissao.toFixed(2))

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
