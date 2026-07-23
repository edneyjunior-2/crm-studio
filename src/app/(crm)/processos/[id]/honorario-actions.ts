'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'

export interface CriarHonorarioInput {
  processoId:     string
  descricao:      string
  valor:          number
  dataVencimento: string   // 'YYYY-MM-DD'
}

export async function criarHonorarioProcesso(
  input: CriarHonorarioInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const erroModulo = await assertModulo('processos')
  if (erroModulo) return { error: erroModulo }

  const { empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { data: proc } = await supabase
    .from('processos_juridicos')
    .select('id, cliente_id')
    .eq('id', input.processoId)
    .eq('empresa_id', empresaId)
    .single()
  if (!proc) return { error: 'Processo não encontrado ou sem permissão.' }

  // Evita duplicar: só 1 honorário lançado por processo (se precisar de mais,
  // o usuário lança manualmente em Contas a Receber depois — fora do escopo aqui).
  const { data: existente } = await supabase
    .from('contas_receber')
    .select('id')
    .eq('processo_id', input.processoId)
    .maybeSingle()
  if (existente) return { error: 'Este processo já tem um honorário lançado no Financeiro.' }

  if (!input.descricao.trim()) return { error: 'Descrição obrigatória.' }
  if (input.valor <= 0 || Number.isNaN(input.valor)) return { error: 'Valor inválido.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dataVencimento)) return { error: 'Data de vencimento inválida.' }

  const { error } = await supabase.from('contas_receber').insert({
    descricao:       input.descricao.trim(),
    valor:           input.valor,
    data_vencimento: input.dataVencimento,
    status:          'pendente',
    cliente_id:      proc.cliente_id,
    processo_id:     input.processoId,
    created_by:      user.id,
  })

  if (error) {
    // 23505 = violação do índice único parcial idx_contas_receber_processo_unico
    // (2 cliques rápidos/2 abas passando os dois pela checagem acima antes de
    // qualquer insert terminar) — a trava real é o banco, a checagem acima é só
    // um atalho de UX pro caso comum; nunca confiar só em ler-depois-escrever.
    if (error.code === '23505') return { error: 'Este processo já tem um honorário lançado no Financeiro.' }
    return { error: error.message }
  }

  revalidatePath(`/processos/${input.processoId}`)
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/honorarios')
  return {}
}
