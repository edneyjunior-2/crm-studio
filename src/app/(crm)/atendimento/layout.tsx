import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'

// ponytail: só o check de usuário aqui (sem requireModulo de plano) — atendimento
// é add-on reservado já controlado por modulos_ativos; não queremos novo paywall.
export default async function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const { role, modulosPermitidos } = await getAuthUser()
  if (role !== 'admin' && modulosPermitidos != null && !modulosPermitidos.includes('atendimentos')) {
    redirect('/dashboard')
  }
  return <>{children}</>
}
