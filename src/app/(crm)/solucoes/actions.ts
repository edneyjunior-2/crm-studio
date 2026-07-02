'use server'

import { revalidatePath } from 'next/cache'
import { getAuthAdmin } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import { LIMITES_POR_PLANO } from '@/lib/modulos'

export async function createSolucao(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user, empresaId, plano } = await getAuthAdmin()

  const erroModulo = await assertModulo('solucoes')
  if (erroModulo) return { error: erroModulo }

  // Limite de plano: conta soluções ATIVAS da empresa. -1 = ilimitado.
  const limiteSolucoes = LIMITES_POR_PLANO[plano].solucoes
  if (limiteSolucoes !== -1 && empresaId) {
    const { count, error: countError } = await supabase
      .from('solucoes')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
    if (countError) return { error: countError.message }
    if ((count ?? 0) >= limiteSolucoes) {
      return {
        error: `Limite de ${limiteSolucoes} soluções ativas do seu plano atingido. Faça upgrade para cadastrar mais.`,
      }
    }
  }

  const comissaoRaw = formData.get('comissao_percentual') as string
  const comissao = comissaoRaw ? parseFloat(comissaoRaw) : null

  const { error } = await supabase.from('solucoes').insert({
    nome: formData.get('nome') as string,
    empresa_representada: (formData.get('empresa_representada') as string) || null,
    descricao: (formData.get('descricao') as string) || null,
    comissao_percentual: comissao,
    ativo: formData.get('ativo') === 'true',
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/solucoes')
  return {}
}

export async function updateSolucao(id: string, formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthAdmin()

  const comissaoRaw = formData.get('comissao_percentual') as string
  const comissao = comissaoRaw ? parseFloat(comissaoRaw) : null

  const { error } = await supabase
    .from('solucoes')
    .update({
      nome: formData.get('nome') as string,
      empresa_representada: (formData.get('empresa_representada') as string) || null,
      descricao: (formData.get('descricao') as string) || null,
      comissao_percentual: comissao,
      ativo: formData.get('ativo') === 'true',
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/solucoes')
  revalidatePath(`/solucoes/${id}`)
  return {}
}

export async function deleteSolucao(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthAdmin()

  // negocio_produtos.solucao_id é ON DELETE SET NULL: excluir sem checar zeraria
  // silenciosamente a solução (e a comissão) de negócios já fechados/em andamento.
  // negocios.solucao_id ainda é RESTRICT/NO ACTION, mas checar aqui também dá um
  // erro amigável em vez do erro cru de violação de FK.
  const [{ count: emProdutos, error: errProdutos }, { count: emNegocios, error: errNegocios }] =
    await Promise.all([
      supabase.from('negocio_produtos').select('id', { count: 'exact', head: true }).eq('solucao_id', id),
      supabase.from('negocios').select('id', { count: 'exact', head: true }).eq('solucao_id', id),
    ])

  if (errProdutos) return { error: errProdutos.message }
  if (errNegocios) return { error: errNegocios.message }
  if ((emProdutos ?? 0) > 0 || (emNegocios ?? 0) > 0) {
    return { error: 'Esta solução está em uso em negócios e não pode ser excluída.' }
  }

  const { error } = await supabase.from('solucoes').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/solucoes')
  return {}
}

export async function toggleAtivo(id: string, ativo: boolean): Promise<{ error?: string }> {
  const { supabase } = await getAuthAdmin()

  const { error } = await supabase
    .from('solucoes')
    .update({ ativo })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/solucoes')
  return {}
}
