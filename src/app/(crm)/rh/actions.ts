'use server'

import { revalidatePath } from 'next/cache'
import { getAuthAdmin } from '@/lib/auth'
import { colaboradorSchema, ausenciaSchema, lancamentoFolhaSchema } from '@/lib/schemas-rh'

// ============================================================================
// Colaboradores
// ============================================================================

export async function createColaborador(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthAdmin()

  const raw = {
    nome: formData.get('nome'),
    cpf: formData.get('cpf') || null,
    cargo: formData.get('cargo') || null,
    departamento: formData.get('departamento') || null,
    email: formData.get('email') || null,
    telefone: formData.get('telefone') || null,
    data_admissao: formData.get('data_admissao') || null,
    data_desligamento: formData.get('data_desligamento') || null,
    status: formData.get('status') || 'ativo',
    tipo_contrato: formData.get('tipo_contrato') || null,
    salario: formData.get('salario') || null,
    tipo_remuneracao: formData.get('tipo_remuneracao') || 'mensal',
  }

  const parsed = colaboradorSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const { error } = await supabase.from('colaboradores').insert({
    ...parsed.data,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/rh')
  return {}
}

export async function updateColaborador(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await getAuthAdmin()

  const raw = {
    nome: formData.get('nome'),
    cpf: formData.get('cpf') || null,
    cargo: formData.get('cargo') || null,
    departamento: formData.get('departamento') || null,
    email: formData.get('email') || null,
    telefone: formData.get('telefone') || null,
    data_admissao: formData.get('data_admissao') || null,
    data_desligamento: formData.get('data_desligamento') || null,
    status: formData.get('status') || 'ativo',
    tipo_contrato: formData.get('tipo_contrato') || null,
    salario: formData.get('salario') || null,
    tipo_remuneracao: formData.get('tipo_remuneracao') || 'mensal',
  }

  const parsed = colaboradorSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const { error } = await supabase
    .from('colaboradores')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/rh')
  return {}
}

export async function desligarColaborador(
  id: string,
  dataDesligamento: string
): Promise<{ error?: string }> {
  const { supabase } = await getAuthAdmin()

  if (!dataDesligamento || !/^\d{4}-\d{2}-\d{2}$/.test(dataDesligamento)) {
    return { error: 'Data de desligamento inválida.' }
  }

  const { error } = await supabase
    .from('colaboradores')
    .update({ status: 'desligado', data_desligamento: dataDesligamento })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/rh')
  return {}
}

// ============================================================================
// Ausências
// ============================================================================

export async function registrarAusencia(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthAdmin()

  const raw = {
    colaborador_id: formData.get('colaborador_id'),
    tipo: formData.get('tipo'),
    data_inicio: formData.get('data_inicio'),
    data_fim: formData.get('data_fim') || null,
    observacao: formData.get('observacao') || null,
  }

  const parsed = ausenciaSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const { error } = await supabase.from('ausencias').insert({
    ...parsed.data,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/rh')
  return {}
}

// ============================================================================
// Folha de Pagamento
// ============================================================================

export async function salvarLancamentoFolha(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthAdmin()

  const raw = {
    colaborador_id: formData.get('colaborador_id'),
    competencia: formData.get('competencia'),
    salario_base: formData.get('salario_base') || '0',
    beneficios: formData.get('beneficios') || '0',
    descontos: formData.get('descontos') || '0',
    status: formData.get('status') || 'aberto',
  }

  const parsed = lancamentoFolhaSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const salarioBase = parsed.data.salario_base ?? 0
  const beneficios = parsed.data.beneficios ?? 0
  const descontos = parsed.data.descontos ?? 0
  const total = salarioBase + beneficios - descontos

  // Verificar se já existe lançamento para este colaborador/competência
  const { data: existente } = await supabase
    .from('lancamentos_folha')
    .select('id')
    .eq('colaborador_id', parsed.data.colaborador_id)
    .eq('competencia', parsed.data.competencia)
    .maybeSingle()

  if (existente?.id) {
    // Atualizar lançamento existente
    const { error } = await supabase
      .from('lancamentos_folha')
      .update({
        salario_base: salarioBase,
        beneficios,
        descontos,
        total,
        status: parsed.data.status,
      })
      .eq('id', existente.id)

    if (error) return { error: error.message }
  } else {
    // Criar novo lançamento
    const { error } = await supabase.from('lancamentos_folha').insert({
      colaborador_id: parsed.data.colaborador_id,
      competencia: parsed.data.competencia,
      salario_base: salarioBase,
      beneficios,
      descontos,
      total,
      status: parsed.data.status,
      created_by: user.id,
    })

    if (error) return { error: error.message }
  }

  revalidatePath('/rh')
  return {}
}
