'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'

/**
 * Seleciona a empresa ativa para o platform admin.
 * Chama a RPC `set_empresa_ativa` no banco, que valida:
 *  - chamador é platform admin (levanta 'forbidden' caso contrário)
 *  - empresa existe (levanta 'empresa not found' caso contrário)
 * Em caso de sucesso, redireciona para /dashboard.
 */
export async function selecionarEmpresa(empresaId: string): Promise<{ error: string } | never> {
  const { supabase, isPlatformAdmin } = await getAuthUser()

  // Guarda de segurança no app layer (a RPC também valida no banco)
  if (!isPlatformAdmin) {
    return { error: 'Acesso negado: apenas platform admins podem trocar de tenant.' }
  }

  const { error } = await supabase.rpc('set_empresa_ativa', { p_empresa: empresaId })

  if (error) {
    return { error: `Não foi possível selecionar a empresa: ${error.message}` }
  }

  // Trocar de tenant muda os dados de TODAS as rotas → invalida o cache do app
  // inteiro pra nenhuma tela ficar mostrando o tenant anterior (cache velho).
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
