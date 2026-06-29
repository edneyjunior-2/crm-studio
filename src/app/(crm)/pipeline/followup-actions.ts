'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  // cliente_id derivado do negócio → a atividade aparece também no detalhe do cliente.
  const { data: negEmail } = await supabase.from('negocios').select('cliente_id').eq('id', negocioId).single()

  // Salva a atividade de e-mail
  const { error: atividadeErr } = await supabase.from('atividades').insert({
    negocio_id: negocioId,
    cliente_id: negEmail?.cliente_id ?? null,
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

