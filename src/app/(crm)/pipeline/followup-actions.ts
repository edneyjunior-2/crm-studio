'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Followup } from '@/types'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function registrarEmailComFollowups(
  negocioId: string,
  responsavelId: string,
  observacao: string,
  agendarD3: boolean,
  agendarD7: boolean
): Promise<{ error?: string }> {
  const { supabase, user } = await getUser()

  const hoje = new Date()
  const hojeStr = toDateStr(hoje)

  // Salva a atividade de e-mail
  const { error: atividadeErr } = await supabase.from('atividades').insert({
    negocio_id: negocioId,
    responsavel_id: user.id,
    tipo: 'email',
    descricao: observacao || 'E-mail enviado ao cliente.',
    data_atividade: hojeStr,
  })
  if (atividadeErr) return { error: atividadeErr.message }

  // Agenda os follow-ups selecionados
  const followups = []
  if (agendarD3) {
    const d3 = new Date(hoje)
    d3.setDate(hoje.getDate() + 3)
    followups.push({
      negocio_id: negocioId,
      responsavel_id: responsavelId,
      tipo: 'd3',
      data_agendada: toDateStr(d3),
      status: 'pendente',
      created_by: user.id,
    })
  }
  if (agendarD7) {
    const d7 = new Date(hoje)
    d7.setDate(hoje.getDate() + 7)
    followups.push({
      negocio_id: negocioId,
      responsavel_id: responsavelId,
      tipo: 'd7',
      data_agendada: toDateStr(d7),
      status: 'pendente',
      created_by: user.id,
    })
  }

  if (followups.length > 0) {
    const { error: followupErr } = await supabase.from('followups').insert(followups)
    if (followupErr) return { error: followupErr.message }
  }

  revalidatePath('/pipeline')
  revalidatePath('/dashboard')
  return {}
}

export async function concluirFollowup(id: string): Promise<{ error?: string }> {
  const { supabase } = await getUser()

  const { error } = await supabase
    .from('followups')
    .update({ status: 'concluido' })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/pipeline')
  return {}
}

export async function getFollowupsPendentes(): Promise<{ data: Followup[]; error?: string }> {
  const { supabase, user } = await getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const hoje = new Date()
  const hojeStr = toDateStr(hoje)

  let query = supabase
    .from('followups')
    .select('*, negocios(titulo, clientes(razao_social))')
    .lte('data_agendada', hojeStr)
    .eq('status', 'pendente')
    .order('data_agendada', { ascending: true })

  if (profile?.role === 'comercial') {
    query = query.eq('responsavel_id', user.id)
  }

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Followup[] }
}
