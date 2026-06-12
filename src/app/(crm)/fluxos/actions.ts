'use server'

import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'

// ─── Fluxos ────────────────────────────────────────────────────────────────

export async function getFluxos() {
  const { supabase, user, role } = await getAuthUser()

  let query = supabase
    .from('fluxos')
    .select(`*, owner:profiles!owner_id(full_name)`)
    .order('created_at', { ascending: false })

  if (role === 'admin') {
    // admin vê tudo
  } else if (role === 'socio') {
    // sócio vê apenas os próprios
    query = query.eq('owner_id', user.id)
  } else {
    // comercial vê apenas boards compartilhados
    query = query.eq('visibilidade', 'todos_comerciais')
  }

  const { data, error } = await query
  return { data, error, role, userId: user.id }
}

export async function createFluxo(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user, role } = await getAuthUser()

  if (!['admin', 'socio'].includes(role ?? '')) {
    return { error: 'Sem permissão para criar fluxos.' }
  }

  const { error } = await supabase.from('fluxos').insert({
    titulo: formData.get('titulo') as string,
    descricao: (formData.get('descricao') as string) || null,
    owner_id: user.id,
    visibilidade: (formData.get('visibilidade') as string) || 'privado',
  })

  if (error) return { error: error.message }

  revalidatePath('/fluxos')
  return {}
}

export async function updateFluxo(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, user, role } = await getAuthUser()

  const { data: fluxo } = await supabase
    .from('fluxos')
    .select('owner_id')
    .eq('id', id)
    .single()

  const isAdmin = role === 'admin'
  const isOwner = fluxo?.owner_id === user.id

  if (!isAdmin && !isOwner) {
    return { error: 'Sem permissão para editar este fluxo.' }
  }

  const { error } = await supabase
    .from('fluxos')
    .update({
      titulo: formData.get('titulo') as string,
      descricao: (formData.get('descricao') as string) || null,
      visibilidade: formData.get('visibilidade') as string,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/fluxos')
  revalidatePath(`/fluxos/${id}`)
  return {}
}

export async function deleteFluxo(id: string): Promise<{ error?: string }> {
  const { supabase, user, role } = await getAuthUser()

  const { data: fluxo } = await supabase
    .from('fluxos')
    .select('owner_id')
    .eq('id', id)
    .single()

  const isAdmin = role === 'admin'
  const isOwner = fluxo?.owner_id === user.id

  if (!isAdmin && !isOwner) {
    return { error: 'Sem permissão para excluir este fluxo.' }
  }

  const { error } = await supabase.from('fluxos').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/fluxos')
  return {}
}

// ─── Colunas ────────────────────────────────────────────────────────────────

export async function createColuna(
  fluxoId: string,
  titulo: string,
  cor: string
): Promise<{ error?: string }> {
  const { supabase, user, role } = await getAuthUser()

  if (!['admin', 'socio'].includes(role ?? '')) {
    return { error: 'Sem permissão para criar colunas.' }
  }

  // Verifica ownership (admin bypassa)
  if (role !== 'admin') {
    const { data: fluxo } = await supabase
      .from('fluxos')
      .select('owner_id')
      .eq('id', fluxoId)
      .single()
    if (fluxo?.owner_id !== user.id) {
      return { error: 'Sem permissão para editar este fluxo.' }
    }
  }

  // Calcula próxima ordem
  const { data: existentes } = await supabase
    .from('fluxo_colunas')
    .select('ordem')
    .eq('fluxo_id', fluxoId)
    .order('ordem', { ascending: false })
    .limit(1)

  const proximaOrdem = existentes && existentes.length > 0 ? existentes[0].ordem + 1 : 0

  const { error } = await supabase.from('fluxo_colunas').insert({
    fluxo_id: fluxoId,
    titulo,
    cor,
    ordem: proximaOrdem,
  })

  if (error) return { error: error.message }

  revalidatePath(`/fluxos/${fluxoId}`)
  return {}
}

export async function updateColuna(
  id: string,
  titulo: string,
  cor: string
): Promise<{ error?: string }> {
  const { supabase, user, role } = await getAuthUser()

  if (!['admin', 'socio'].includes(role ?? '')) {
    return { error: 'Sem permissão para editar colunas.' }
  }

  const { data: coluna } = await supabase
    .from('fluxo_colunas')
    .select('fluxo_id')
    .eq('id', id)
    .single()

  if (!coluna) return { error: 'Coluna não encontrada.' }

  if (role !== 'admin') {
    const { data: fluxo } = await supabase
      .from('fluxos')
      .select('owner_id')
      .eq('id', coluna.fluxo_id)
      .single()
    if (fluxo?.owner_id !== user.id) {
      return { error: 'Sem permissão para editar este fluxo.' }
    }
  }

  const { error } = await supabase
    .from('fluxo_colunas')
    .update({ titulo, cor })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/fluxos/${coluna.fluxo_id}`)
  return {}
}

export async function deleteColuna(id: string): Promise<{ error?: string }> {
  const { supabase, user, role } = await getAuthUser()

  if (!['admin', 'socio'].includes(role ?? '')) {
    return { error: 'Sem permissão para excluir colunas.' }
  }

  const { data: coluna } = await supabase
    .from('fluxo_colunas')
    .select('fluxo_id')
    .eq('id', id)
    .single()

  if (!coluna) return { error: 'Coluna não encontrada.' }

  if (role !== 'admin') {
    const { data: fluxo } = await supabase
      .from('fluxos')
      .select('owner_id')
      .eq('id', coluna.fluxo_id)
      .single()
    if (fluxo?.owner_id !== user.id) {
      return { error: 'Sem permissão para editar este fluxo.' }
    }
  }

  const { error } = await supabase.from('fluxo_colunas').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/fluxos/${coluna.fluxo_id}`)
  return {}
}

export async function reorderColunas(
  fluxoId: string,
  ids: string[]
): Promise<{ error?: string }> {
  const { supabase, role } = await getAuthUser()

  if (!['admin', 'socio'].includes(role ?? '')) {
    return { error: 'Sem permissão.' }
  }

  // Paraleliza os updates com Promise.all — cada coluna recebe sua nova ordem
  // simultaneamente. Ideal futuro: substituir por uma RPC que aceite um array
  // de { id, ordem } e resolva tudo em uma única transação no banco.
  const updates = ids.map((id, index) =>
    supabase.from('fluxo_colunas').update({ ordem: index }).eq('id', id)
  )

  await Promise.all(updates)

  revalidatePath(`/fluxos/${fluxoId}`)
  return {}
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export async function createCard(
  colunaId: string,
  fluxoId: string,
  titulo: string,
  descricao?: string
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser()

  // Calcula próxima ordem dentro da coluna
  const { data: existentes } = await supabase
    .from('fluxo_cards')
    .select('ordem')
    .eq('coluna_id', colunaId)
    .order('ordem', { ascending: false })
    .limit(1)

  const proximaOrdem = existentes && existentes.length > 0 ? existentes[0].ordem + 1 : 0

  const { error } = await supabase.from('fluxo_cards').insert({
    fluxo_id: fluxoId,
    coluna_id: colunaId,
    titulo,
    descricao: descricao || null,
    responsavel_id: user.id,
    ordem: proximaOrdem,
  })

  if (error) return { error: error.message }

  revalidatePath(`/fluxos/${fluxoId}`)
  return {}
}

export async function updateCard(
  id: string,
  data: { titulo?: string; descricao?: string | null }
): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()

  const { data: card } = await supabase
    .from('fluxo_cards')
    .select('fluxo_id')
    .eq('id', id)
    .single()

  if (!card) return { error: 'Card não encontrado.' }

  const { error } = await supabase
    .from('fluxo_cards')
    .update(data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/fluxos/${card.fluxo_id}`)
  return {}
}

export async function moveCard(
  cardId: string,
  novaColunaId: string
): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()

  const { data: card } = await supabase
    .from('fluxo_cards')
    .select('fluxo_id')
    .eq('id', cardId)
    .single()

  if (!card) return { error: 'Card não encontrado.' }

  // Calcula próxima ordem na coluna destino
  const { data: existentes } = await supabase
    .from('fluxo_cards')
    .select('ordem')
    .eq('coluna_id', novaColunaId)
    .order('ordem', { ascending: false })
    .limit(1)

  const proximaOrdem = existentes && existentes.length > 0 ? existentes[0].ordem + 1 : 0

  const { error } = await supabase
    .from('fluxo_cards')
    .update({ coluna_id: novaColunaId, ordem: proximaOrdem })
    .eq('id', cardId)

  if (error) return { error: error.message }

  revalidatePath(`/fluxos/${card.fluxo_id}`)
  return {}
}

export async function deleteCard(id: string): Promise<{ error?: string }> {
  const { supabase, user, role } = await getAuthUser()

  const { data: card } = await supabase
    .from('fluxo_cards')
    .select('fluxo_id')
    .eq('id', id)
    .single()

  if (!card) return { error: 'Card não encontrado.' }

  if (!['admin', 'socio'].includes(role ?? '')) {
    // comercial não pode deletar
    return { error: 'Sem permissão para excluir cards.' }
  }

  if (role !== 'admin') {
    const { data: fluxo } = await supabase
      .from('fluxos')
      .select('owner_id')
      .eq('id', card.fluxo_id)
      .single()
    if (fluxo?.owner_id !== user.id) {
      return { error: 'Sem permissão para editar este fluxo.' }
    }
  }

  const { error } = await supabase.from('fluxo_cards').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/fluxos/${card.fluxo_id}`)
  return {}
}
