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
  // mensal → +1 mês, demais → própria data de fechamento
  function calcVencimento(base: string, periodo: string): string {
    const [ano, mes, dia] = base.split('-').map(Number)
    if (periodo === 'mensal') {
      const d = new Date(ano, mes, dia) // mes já é 1-based, então Date usa mes como próximo mês
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    const { data: novaConta, error: contaErr } = await supabase
      .from('contas_receber')
      .insert({
        negocio_id: negocioId,
        cliente_id: negocio.cliente_id,
        descricao: `Recebível — ${negocio.titulo}`,
        valor: negocio.valor_estimado ?? 0,
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
  } else {
    contaReceberId = contaExistente.id
  }

  // ----------------------------------------------------------------
  // 2. Comissão prevista — idempotente por negocio_id
  // ----------------------------------------------------------------
  let comissaoId: string | undefined

  // Só gera comissão se houver solução com comissao_percentual
  if (negocio.solucao_id) {
    const { data: solucao } = await supabase
      .from('solucoes')
      .select('comissao_percentual')
      .eq('id', negocio.solucao_id)
      .maybeSingle()

    const percentual = solucao?.comissao_percentual ?? null

    if (percentual && percentual > 0 && negocio.valor_estimado) {
      const { data: comissaoExistente } = await supabase
        .from('comissoes_comercial')
        .select('id')
        .eq('negocio_id', negocioId)
        .maybeSingle()

      if (!comissaoExistente) {
        const valorComissao = Number(
          ((negocio.valor_estimado * percentual) / 100).toFixed(2)
        )

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
  }

  revalidatePath('/financeiro')
  revalidatePath('/pipeline')

  const mensagem =
    gerados.length > 0
      ? `Gerado: ${gerados.join(' e ')}.`
      : 'Registros financeiros já existiam — nenhum duplicado criado.'

  return { contaReceberId, comissaoId, mensagem }
}
