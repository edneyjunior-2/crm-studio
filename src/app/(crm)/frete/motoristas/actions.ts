'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import { motoristaFreteSchema } from '@/lib/schemas'

export interface MotoristaActionState { error?: string; id?: string }

export async function criarMotorista(
  _prev: MotoristaActionState | null,
  formData: FormData,
): Promise<MotoristaActionState | null> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const parsed = motoristaFreteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }

  // motoristaFreteSchema (Stream 1) não cobre observacoes — lido direto do FormData.
  const observacoes = (formData.get('observacoes') as string)?.trim() || null

  const { data, error } = await supabase
    .from('frete_motoristas')
    .insert({
      empresa_id:     empresaId,
      nome:           parsed.data.nome,
      cpf:            parsed.data.cpf,
      cnh_numero:     parsed.data.cnh_numero,
      cnh_categoria:  parsed.data.cnh_categoria,
      cnh_validade:   parsed.data.cnh_validade ?? null,
      vinculo:        parsed.data.vinculo,
      rntrc:          parsed.data.rntrc ?? null,
      observacoes,
      ativo:          true,
      created_by:     user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/frete/motoristas')
  return { id: data.id }
}

export async function atualizarMotorista(
  _prev: MotoristaActionState | null,
  formData: FormData,
): Promise<MotoristaActionState | null> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const motoristaId = (formData.get('motorista_id') as string)?.trim()
  if (!motoristaId) return { error: 'Motorista não informado.' }

  const parsed = motoristaFreteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }

  // motoristaFreteSchema (Stream 1) não cobre observacoes — lido direto do FormData.
  const observacoes = (formData.get('observacoes') as string)?.trim() || null

  // ponytail: status ativo/inativo é editado junto do form (sem action separada de toggle).
  const ativoRaw = (formData.get('ativo') as string) ?? 'true'
  const ativo    = ativoRaw !== 'false'

  const { error } = await supabase
    .from('frete_motoristas')
    .update({
      nome:          parsed.data.nome,
      cpf:           parsed.data.cpf,
      cnh_numero:    parsed.data.cnh_numero,
      cnh_categoria: parsed.data.cnh_categoria,
      cnh_validade:  parsed.data.cnh_validade ?? null,
      vinculo:       parsed.data.vinculo,
      rntrc:         parsed.data.rntrc ?? null,
      observacoes,
      ativo,
    })
    .eq('id', motoristaId)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/frete/motoristas/${motoristaId}`)
  revalidatePath('/frete/motoristas')
  redirect(`/frete/motoristas/${motoristaId}`)
}

export async function excluirMotorista(id: string): Promise<{ error?: string }> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const { supabase, empresaId, role } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }
  // A policy delete_admin (20260716140500_modulo_frete_schema.sql) só permite DELETE
  // para role=admin — sem este check, um não-admin clicaria "Excluir" e a RLS
  // filtraria a linha silenciosamente (0 rows afetadas, sem erro do Postgres),
  // dando falso sucesso na UI. Barra aqui com mensagem clara antes de tentar.
  if (role !== 'admin') return { error: 'Apenas administradores podem excluir motoristas.' }

  const { error } = await supabase
    .from('frete_motoristas')
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/frete/motoristas')
  redirect('/frete/motoristas')
}
