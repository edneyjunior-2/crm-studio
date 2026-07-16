'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import { veiculoFreteSchema } from '@/lib/schemas'

export interface VeiculoActionState { error?: string; id?: string }

export async function criarVeiculo(
  _prev: VeiculoActionState | null,
  formData: FormData,
): Promise<VeiculoActionState | null> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const { supabase, user, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const parsed = veiculoFreteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }

  const { data, error } = await supabase
    .from('frete_veiculos')
    .insert({
      empresa_id:  empresaId,
      placa:       parsed.data.placa,
      tipo:        parsed.data.tipo,
      eixos:       parsed.data.eixos ?? null,
      rntrc:       parsed.data.rntrc ?? null,
      observacoes: parsed.data.observacoes ?? null,
      ativo:       true,
      created_by:  user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/frete/veiculos')
  return { id: data.id }
}

export async function atualizarVeiculo(
  _prev: VeiculoActionState | null,
  formData: FormData,
): Promise<VeiculoActionState | null> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const veiculoId = (formData.get('veiculo_id') as string)?.trim()
  if (!veiculoId) return { error: 'Veículo não informado.' }

  const parsed = veiculoFreteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }

  // ponytail: status ativo/inativo é editado junto do form (sem action separada de toggle).
  const ativoRaw = (formData.get('ativo') as string) ?? 'true'
  const ativo    = ativoRaw !== 'false'

  const { error } = await supabase
    .from('frete_veiculos')
    .update({
      placa:       parsed.data.placa,
      tipo:        parsed.data.tipo,
      eixos:       parsed.data.eixos ?? null,
      rntrc:       parsed.data.rntrc ?? null,
      observacoes: parsed.data.observacoes ?? null,
      ativo,
    })
    .eq('id', veiculoId)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/frete/veiculos/${veiculoId}`)
  revalidatePath('/frete/veiculos')
  redirect(`/frete/veiculos/${veiculoId}`)
}

export async function excluirVeiculo(id: string): Promise<{ error?: string }> {
  const erroModulo = await assertModulo('frete')
  if (erroModulo) return { error: erroModulo }

  const { supabase, empresaId, role } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }
  // A policy delete_admin (20260716140500_modulo_frete_schema.sql) só permite DELETE
  // para role=admin — sem este check, um não-admin clicaria "Excluir" e a RLS
  // filtraria a linha silenciosamente (0 rows afetadas, sem erro do Postgres),
  // dando falso sucesso na UI. Barra aqui com mensagem clara antes de tentar.
  if (role !== 'admin') return { error: 'Apenas administradores podem excluir veículos.' }

  const { error } = await supabase
    .from('frete_veiculos')
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/frete/veiculos')
  redirect('/frete/veiculos')
}
