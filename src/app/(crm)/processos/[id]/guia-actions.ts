'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface CriarGuiaInput {
  processoId:     string
  descricao:      string
  valor:          number
  dataVencimento: string   // 'YYYY-MM-DD'
  categoria:      string | null
}

export async function criarGuiaProcesso(
  input: CriarGuiaInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (!profile?.empresa_id) return { error: 'Empresa não encontrada.' }

  // Verifica que o processo pertence à mesma empresa
  const { data: proc } = await supabase
    .from('processos_juridicos')
    .select('id')
    .eq('id', input.processoId)
    .eq('empresa_id', profile.empresa_id)
    .single()

  if (!proc) return { error: 'Processo não encontrado ou sem permissão.' }

  if (!input.descricao.trim()) return { error: 'Descrição obrigatória.' }
  if (input.valor <= 0 || Number.isNaN(input.valor)) return { error: 'Valor inválido.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dataVencimento)) return { error: 'Data de vencimento inválida.' }

  const { error } = await supabase.from('contas_pagar').insert({
    descricao:       input.descricao.trim(),
    valor:           input.valor,
    data_vencimento: input.dataVencimento,
    categoria:       input.categoria || null,
    status:          'pendente',
    recorrente:      false,
    frequencia:      null,
    is_cartao:       false,
    processo_id:     input.processoId,
    created_by:      user.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/processos/${input.processoId}`)
  revalidatePath('/financeiro')
  return {}
}
