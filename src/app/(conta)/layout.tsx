/**
 * Layout do grupo (conta) — cobre /assinatura e /upgrade.
 *
 * IMPORTANTE: este layout só verifica autenticação (getAuthUser → redirect /login
 * se não autenticado). Ele NÃO chama acessoLiberado() nem requireModulo() para
 * evitar loop de redirect quando o status é 'suspenso' ou 'cancelado'.
 */
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'

export default async function ContaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getAuthUser já redireciona para /login se sem sessão
  const { user } = await getAuthUser()

  // Segurança extra: se por algum motivo user vier nulo, bloqueia
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
