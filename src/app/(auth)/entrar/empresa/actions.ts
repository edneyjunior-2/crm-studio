'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type EntrarNaEmpresaState =
  | { step: 'idle'; error?: string }
  | { step: 'preview'; empresaId: string; empresaNome: string; codigo: string }
  | { step: 'done' }

export async function entrarNaEmpresa(
  _prev: EntrarNaEmpresaState,
  formData: FormData
): Promise<EntrarNaEmpresaState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const step = formData.get('_step') as string | null

  // ── Passo 2: confirmar vinculação ─────────────────────────────────────────
  if (step === 'confirmar') {
    // Segurança: NUNCA confiar no empresa_id vindo do form (campo oculto —
    // um usuário mal-intencionado poderia forjar o FormData com o UUID de
    // QUALQUER empresa e se vincular a ela). Em vez disso, re-exigimos o
    // CÓDIGO de acesso e re-executamos a MESMA validação server-side do
    // passo 1 (RPC SECURITY DEFINER) para obter o empresa_id REAL.
    const rawCodigo = formData.get('codigo') as string | null
    const codigo = rawCodigo?.trim().toUpperCase() ?? ''
    if (!codigo) return { step: 'idle', error: 'Sessão expirada. Digite o código novamente.' }

    const { data: empresas, error } = await supabase
      .rpc('buscar_empresa_por_codigo', { p_codigo: codigo })

    const empresa = empresas?.[0] ?? null

    if (error || !empresa) {
      return { step: 'idle', error: 'Código inválido. Verifique com o administrador da sua empresa.' }
    }

    if (empresa.status === 'cancelado') {
      return { step: 'idle', error: 'Esta empresa não tem uma assinatura ativa no CRM Studio.' }
    }

    // Nunca permite TROCAR de empresa por aqui — só vincula quem ainda está sem.
    const { data: profileAtual } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('id', user.id)
      .single()

    if (profileAtual?.empresa_id) redirect('/dashboard')

    // Guarda condicional (.is empresa_id null) como trava extra contra corrida
    // de duplo-submit — só atualiza quem, no instante do UPDATE, ainda está
    // sem empresa_id.
    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update({ empresa_id: empresa.id })
      .eq('id', user.id)
      .is('empresa_id', null)
      .select('id')

    if (updateErr) return { step: 'idle', error: 'Erro ao vincular à empresa. Tente novamente.' }
    if (!updated || updated.length === 0) redirect('/dashboard')

    redirect('/dashboard')
  }

  // ── Passo 1: buscar empresa pelo código via RPC SECURITY DEFINER ──────────
  // Usamos a RPC porque a policy empresa_self_select exige current_empresa_id(),
  // que é NULL para usuários sem empresa_id — a consulta direta retornaria vazio.
  const rawCodigo = formData.get('codigo') as string | null
  const codigo = rawCodigo?.trim().toUpperCase() ?? ''

  if (!codigo) return { step: 'idle', error: 'Digite o código de acesso.' }

  const { data: empresas, error } = await supabase
    .rpc('buscar_empresa_por_codigo', { p_codigo: codigo })

  const empresa = empresas?.[0] ?? null

  if (error || !empresa) {
    return { step: 'idle', error: 'Código inválido. Verifique com o administrador da sua empresa.' }
  }

  if (empresa.status === 'cancelado') {
    return { step: 'idle', error: 'Esta empresa não tem uma assinatura ativa no CRM Studio.' }
  }

  return { step: 'preview', empresaId: empresa.id, empresaNome: empresa.nome, codigo }
}
