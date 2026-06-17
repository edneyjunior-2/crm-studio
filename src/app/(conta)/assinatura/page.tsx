/**
 * Página de paywall / assinatura.
 * Fora do grupo (crm) → acessível mesmo com status 'suspenso' ou 'cancelado'.
 * NÃO chama acessoLiberado(). Apenas exibe plano + status + CTA placeholder.
 */
import { getAuthUser } from '@/lib/auth'
import { CheckCircle2, XCircle, Clock, AlertTriangle, CreditCard } from 'lucide-react'
import Link from 'next/link'

const statusInfo: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  trial:    { label: 'Período de teste',         icon: Clock,          className: 'text-sidebar-primary' },
  ativo:    { label: 'Ativo',                    icon: CheckCircle2,   className: 'text-green-500' },
  pendente: { label: 'Pagamento em processamento', icon: CreditCard,   className: 'text-amber-500' },
  atrasado: { label: 'Pagamento atrasado',       icon: AlertTriangle,  className: 'text-orange-500' },
  suspenso: { label: 'Conta suspensa',           icon: XCircle,        className: 'text-destructive' },
  cancelado:{ label: 'Cancelado',                icon: XCircle,        className: 'text-destructive' },
}

const planoLabel: Record<string, string> = {
  free:     'Free',
  starter:  'Starter',
  pro:      'Pro',
  business: 'Business',
}

export default async function AssinaturaPage() {
  const { plano, status } = await getAuthUser()

  const info = statusInfo[status] ?? statusInfo.suspenso
  const StatusIcon = info.icon

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <span className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
            CRM Studio<span className="text-sidebar-primary">.</span>
          </span>
        </div>

        {/* Card de status */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="space-y-6">
            {/* Status atual */}
            <div className="flex items-center gap-3">
              <StatusIcon className={`size-6 shrink-0 ${info.className}`} aria-hidden />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status da conta
                </p>
                <p className={`text-lg font-semibold ${info.className}`}>
                  {info.label}
                </p>
              </div>
            </div>

            {/* Plano atual */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Plano atual
              </p>
              <p className="text-2xl font-bold text-foreground">
                {planoLabel[plano] ?? plano}
              </p>
            </div>

            {/* Mensagem contextual */}
            {(status === 'suspenso' || status === 'cancelado') && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">
                  {status === 'suspenso'
                    ? 'Sua conta foi suspensa por falta de pagamento. Regularize para retomar o acesso.'
                    : 'Sua conta foi cancelada. Assine um plano para voltar a utilizar o CRM Studio.'}
                </p>
              </div>
            )}

            {status === 'trial' && (
              <div className="rounded-lg border border-sidebar-primary/30 bg-sidebar-primary/10 p-4">
                <p className="text-sm text-sidebar-primary">
                  Você está no período de teste. Assine um plano para garantir acesso contínuo após o trial.
                </p>
              </div>
            )}

            {status === 'atrasado' && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Seu pagamento está atrasado. Regularize para evitar a suspensão da conta.
                </p>
              </div>
            )}

            {/* CTA placeholder */}
            <div className="space-y-3">
              <button
                disabled
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sidebar-primary px-6 py-3 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
                title="Em breve"
                type="button"
              >
                <CreditCard className="size-4" aria-hidden />
                Assinar — em breve
              </button>

              {/* Voltar ao app (só se tiver acesso) */}
              {(status === 'trial' || status === 'ativo' || status === 'pendente' || status === 'atrasado') && (
                <Link
                  href="/dashboard"
                  className="flex w-full items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Voltar ao app
                </Link>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Dúvidas? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  )
}
