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
    const empresaId = formData.get('empresa_id') as string | null
    if (!empresaId) return { step: 'idle', error: 'Dados inválidos. Tente novamente.' }

    // Não relemos a empresa aqui — o usuário ainda não tem empresa_id, então
    // current_empresa_id() = NULL e a RLS de empresas bloquearia a query.
    // A validação foi feita no passo 1 via RPC SECURITY DEFINER; o empresaId
    // que chega aqui é o que retornamos no preview.
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ empresa_id: empresaId })
      .eq('id', user.id)

    if (updateErr) return { step: 'idle', error: 'Erro ao vincular à empresa. Tente novamente.' }

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
