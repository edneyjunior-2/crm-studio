'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { assertModulo } from '@/lib/gating'

export interface ContratoGerado {
  id: string
  parceiro_nome: string | null
  parceiro_doc: string | null
  tipo: 'PJ' | 'PF'
  dados: unknown
  created_at: string
}

export async function salvarContratoGerado(input: {
  parceiro_nome: string | null
  parceiro_doc: string | null
  tipo: 'PJ' | 'PF'
  dados: unknown
}): Promise<{ error?: string }> {
  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const erroModulo = await assertModulo('contratos')
  if (erroModulo) return { error: erroModulo }

  const { error } = await supabase.from('contratos_gerados').insert({
    empresa_id:    empresaId,
    parceiro_nome: input.parceiro_nome,
    parceiro_doc:  input.parceiro_doc,
    tipo:          input.tipo,
    dados:         input.dados,
    storage_path:  '',
    created_by:    user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/contratos')
  return {}
}

export async function listarContratosGerados(): Promise<ContratoGerado[]> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return []

  const { data, error } = await supabase
    .from('contratos_gerados')
    .select('id, parceiro_nome, parceiro_doc, tipo, dados, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !data) return []

  return data as ContratoGerado[]
}

export async function excluirContratoGerado(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()

  const { error } = await supabase
    .from('contratos_gerados')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/contratos')
  return {}
}
