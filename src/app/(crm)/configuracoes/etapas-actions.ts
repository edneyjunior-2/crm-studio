'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthAdmin } from '@/lib/auth'
import { slugifyEstagio } from '@/lib/pipeline-estagios'
import type { EstagioTipo } from '@/lib/pipeline-estagios'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Gera slug único para o tenant: tenta base, depois base_2, base_3… */
async function slugUnico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseSlug: string,
): Promise<string> {
  let candidato = baseSlug
  let tentativa = 2
  while (true) {
    const { data } = await supabase
      .from('pipeline_estagios')
      .select('id')
      .eq('slug', candidato)
      .maybeSingle()
    if (!data) return candidato
    candidato = `${baseSlug}_${tentativa}`
    tentativa++
  }
}

function revalidar() {
  revalidatePath('/configuracoes')
  revalidatePath('/pipeline')
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export async function criarEstagio(
  nome: string,
  tipo: EstagioTipo,
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const nomeTrimmed = nome.trim().slice(0, 80)
  if (!nomeTrimmed) return { error: 'O nome da etapa não pode ficar em branco.' }

  const baseSlug = slugifyEstagio(nomeTrimmed)

  // Ordem = max atual + 1
  const { data: maxRow } = await supabase
    .from('pipeline_estagios')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ordem = ((maxRow?.ordem as number | null) ?? 0) + 1

  // Insere com slug único. Em corrida (dois admins criando o mesmo nome ao mesmo
  // tempo) o unique (empresa_id, slug) dispara 23505 — recomputa o slug e tenta de novo.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const slug = await slugUnico(supabase, baseSlug)
    const { error } = await supabase.from('pipeline_estagios').insert({
      empresa_id: empresaId,
      slug,
      nome: nomeTrimmed,
      tipo,
      ordem,
      ativo: true,
    })
    if (!error) {
      revalidar()
      return {}
    }
    if (error.code !== '23505') return { error: error.message }
  }

  return { error: 'Não foi possível gerar um identificador único para a etapa. Tente de novo.' }
}

export async function renomearEstagio(
  id: string,
  nome: string,
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  const nomeTrimmed = nome.trim().slice(0, 80)
  if (!nomeTrimmed) return { error: 'O nome da etapa não pode ficar em branco.' }

  // Segurança: garante que a etapa pertence ao tenant efetivo (RLS já faz, mas dupla garantia)
  const { error } = await supabase
    .from('pipeline_estagios')
    .update({ nome: nomeTrimmed })
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidar()
  return {}
}

export async function setTipoEstagio(
  id: string,
  tipo: EstagioTipo,
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  // Busca tipo atual para saber se é mudança de ganho ou perdido
  const { data: atual } = await supabase
    .from('pipeline_estagios')
    .select('tipo')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!atual) return { error: 'Etapa não encontrada.' }
  const tipoAtual = atual.tipo as EstagioTipo

  // Guard: não deixar zerar ganho/perdido
  if (tipoAtual !== tipo && (tipoAtual === 'ganho' || tipoAtual === 'perdido')) {
    const { count } = await supabase
      .from('pipeline_estagios')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('tipo', tipoAtual)
      .eq('ativo', true)

    if ((count ?? 0) <= 1) {
      const label = tipoAtual === 'ganho' ? '"Ganho"' : '"Perdido"'
      return {
        error: `Não é possível alterar: esta é a única etapa do tipo ${label}. Crie outra etapa ${label} antes de mudar esta.`,
      }
    }
  }

  const { error } = await supabase
    .from('pipeline_estagios')
    .update({ tipo })
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidar()
  return {}
}

export async function reordenarEstagios(
  idsNaOrdem: string[],
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  // Atualiza ordem = índice (0-based) para cada id
  const updates = idsNaOrdem.map((id, idx) =>
    supabase
      .from('pipeline_estagios')
      .update({ ordem: idx })
      .eq('id', id)
      .eq('empresa_id', empresaId),
  )

  const results = await Promise.all(updates)
  const first = results.find((r) => r.error)
  if (first?.error) return { error: first.error.message }

  revalidar()
  return {}
}

export async function removerEstagio(
  id: string,
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }

  // Busca a etapa
  const { data: etapa } = await supabase
    .from('pipeline_estagios')
    .select('tipo, slug')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!etapa) return { error: 'Etapa não encontrada.' }

  const tipo = etapa.tipo as EstagioTipo
  const slug = etapa.slug as string

  // Guard: não remover a última ganho/perdido
  if (tipo === 'ganho' || tipo === 'perdido') {
    const { count } = await supabase
      .from('pipeline_estagios')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('tipo', tipo)
      .eq('ativo', true)

    if ((count ?? 0) <= 1) {
      const label = tipo === 'ganho' ? '"Ganho"' : '"Perdido"'
      return {
        error: `Não é possível remover a última etapa do tipo ${label}. Crie outra antes de remover esta.`,
      }
    }
  }

  // Verifica se há negócios usando o slug desta etapa
  const { count: negociosCount } = await supabase
    .from('negocios')
    .select('id', { count: 'exact', head: true })
    .eq('estagio', slug)

  if ((negociosCount ?? 0) > 0) {
    // Soft-delete: desativa em vez de deletar (slug referenciado)
    const { error } = await supabase
      .from('pipeline_estagios')
      .update({ ativo: false })
      .eq('id', id)
      .eq('empresa_id', empresaId)
    if (error) return { error: error.message }
  } else {
    // Hard-delete: sem referências
    const { error } = await supabase
      .from('pipeline_estagios')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)
    if (error) return { error: error.message }
  }

  revalidar()
  return {}
}
