import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'

// atendimento é add-on RESERVADO, controlado por empresas.modulos_ativos (sem
// paywall de plano). A EMPRESA precisa ter 'atendimentos' ativo E o RBAC do
// usuário precisa permitir. Sem o 1º check, qualquer usuário (modulos_permitidos
// = null, o default) abria /atendimento por URL mesmo a empresa não tendo o add-on.
export default async function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const { role, empresaId, supabase, modulosPermitidos } = await getAuthUser()

  let modulosAtivos: string[] = []
  if (empresaId) {
    const { data } = await supabase.from('empresas').select('modulos_ativos').eq('id', empresaId).single()
    modulosAtivos = data?.modulos_ativos ?? []
  }
  if (!modulosAtivos.includes('atendimentos')) redirect('/dashboard')

  if (role !== 'admin' && modulosPermitidos != null && !modulosPermitidos.includes('atendimentos')) {
    redirect('/dashboard')
  }
  return <>{children}</>
}
