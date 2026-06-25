import { getAuthUser } from '@/lib/auth'
import { MODULOS_POR_PLANO, LIMITES_POR_PLANO, type Modulo } from '@/lib/modulos'
import type { PlanoEmpresa, StatusEmpresa } from '@/lib/auth'
import { CheckCircle2, XCircle, Clock, AlertTriangle, CreditCard, Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { AssinaturaForm } from './assinatura-form'

// ---------------------------------------------------------------------------
// Dados de configuração (estáticos — nunca vêm do banco)
// ---------------------------------------------------------------------------

const PLANO_ORDER: PlanoEmpresa[] = ['starter', 'pro', 'business']

const PLANOS_CONFIG: Record<PlanoEmpresa, { label: string; price: string; tagline: string; trial?: boolean }> = {
  free:     { label: 'Free',     price: 'Grátis',       tagline: '7 dias para explorar sem cartão de crédito.', trial: true },
  trial:    { label: 'Trial',    price: 'Grátis',       tagline: '7 dias para explorar.', trial: true },
  interno:  { label: 'Interno',  price: 'Sem cobrança', tagline: 'Conta interna da plataforma.' },
  starter:  { label: 'Starter',  price: 'R$ 149/mês',  tagline: 'Para o time pequeno vender mais.' },
  pro:      { label: 'Pro',      price: 'R$ 449/mês',  tagline: 'O comercial completo, com financeiro.' },
  business: { label: 'Business', price: 'R$ 990/mês',  tagline: 'Para a operação que precisa de tudo.' },
}

const MODULO_LABEL: Record<Modulo, string> = {
  pipeline:   'Pipeline de vendas',
  clientes:   'Gestão de clientes',
  solucoes:   'Portfólio de soluções',
  parceiros:  'Parceiros e representantes',
  financeiro: 'Financeiro (AP/AR)',
  comissoes:  'Controle de comissões',
  fluxos:     'Fluxos de trabalho',
  calendario: 'Calendário',
  contratos:  'Contratos',
  automacoes: 'Automações de funil',
  estoque:    'Gestão de estoque',
  rh:         'Recursos Humanos',
  processos:  'Processos Jurídicos',
  obras:      'Obras e Construção Civil',
}

type StatusConfig = {
  label: string
  icon: React.ElementType
  containerClass: string
  iconClass: string
  textClass: string
  mensagem: string
}

const STATUS_CONFIG: Record<StatusEmpresa, StatusConfig> = {
  trial: {
    label: 'Período de teste',
    icon: Clock,
    containerClass: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-900 dark:text-amber-200',
    mensagem: 'Você está no período de teste. Assine um plano para garantir acesso contínuo após o trial.',
  },
  ativo: {
    label: 'Assinatura ativa',
    icon: CheckCircle2,
    containerClass: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40',
    iconClass: 'text-green-600 dark:text-green-400',
    textClass: 'text-green-900 dark:text-green-200',
    mensagem: 'Sua assinatura está ativa. Obrigado por ser cliente do CRM Studio.',
  },
  pendente: {
    label: 'Pagamento em processamento',
    icon: CreditCard,
    containerClass: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-900 dark:text-amber-200',
    mensagem: 'Seu pagamento está sendo processado. Você continua com acesso normal durante este período.',
  },
  atrasado: {
    label: 'Pagamento atrasado',
    icon: AlertTriangle,
    containerClass: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40',
    iconClass: 'text-orange-600 dark:text-orange-400',
    textClass: 'text-orange-900 dark:text-orange-200',
    mensagem: 'Seu pagamento está atrasado. Regularize para evitar a suspensão da conta.',
  },
  suspenso: {
    label: 'Conta suspensa',
    icon: XCircle,
    containerClass: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-900 dark:text-red-200',
    mensagem: 'Sua conta foi suspensa por falta de pagamento. Regularize para retomar o acesso.',
  },
  cancelado: {
    label: 'Conta cancelada',
    icon: XCircle,
    containerClass: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-900 dark:text-red-200',
    mensagem: 'Sua conta foi cancelada. Assine um plano para voltar a utilizar o CRM Studio.',
  },
}

const STATUS_COM_ACESSO: StatusEmpresa[] = ['trial', 'ativo', 'pendente', 'atrasado']

function formatarLimite(valor: number): string {
  return valor === -1 ? 'Ilimitado' : String(valor)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AssinaturaPage() {
  const { plano: planoAtual, status } = await getAuthUser()

  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.suspenso
  const StatusIcon = statusCfg.icon
  const temAcesso = (STATUS_COM_ACESSO as StatusEmpresa[]).includes(status)

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Logo */}
        <div className="text-center">
          <span className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
            CRM Studio<span className="text-sidebar-primary">.</span>
          </span>
        </div>

        {/* Banner de status */}
        <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${statusCfg.containerClass}`}>
          <StatusIcon className={`mt-0.5 size-5 shrink-0 ${statusCfg.iconClass}`} aria-hidden />
          <div>
            <p className={`text-sm font-semibold ${statusCfg.textClass}`}>{statusCfg.label}</p>
            <p className={`mt-0.5 text-sm ${statusCfg.textClass} opacity-80`}>{statusCfg.mensagem}</p>
          </div>
        </div>

        {/* Título da seção */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Escolha o plano certo para o seu time
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Preço fixo por empresa — sem cobrança por usuário. Cancele quando quiser.
          </p>
        </div>

        {/* Grid de planos */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANO_ORDER.map((plano) => {
            const cfg = PLANOS_CONFIG[plano]
            const modulos = MODULOS_POR_PLANO[plano]
            const limites = LIMITES_POR_PLANO[plano]
            const isAtual = plano === planoAtual
            const planoIdx = PLANO_ORDER.indexOf(plano)
            const atualIdx = PLANO_ORDER.indexOf(planoAtual)
            const isUpgrade = planoIdx > atualIdx
            const prevModulos = planoIdx > 0 ? MODULOS_POR_PLANO[PLANO_ORDER[planoIdx - 1]] : []
            const isNovo = (m: Modulo) => planoIdx > 0 && !prevModulos.includes(m)

            return (
              <div
                key={plano}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  isAtual
                    ? 'border-primary bg-card shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'border-border bg-card'
                }`}
              >
                {/* Badge plano atual */}
                {isAtual && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold tracking-wide text-primary-foreground">
                      Seu plano atual
                    </span>
                  </div>
                )}

                {/* Nome e preço */}
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-foreground">{cfg.label}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{cfg.tagline}</p>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <p className="text-2xl font-bold text-foreground">{cfg.price}</p>
                    {cfg.trial && <span className="text-xs text-muted-foreground">por 7 dias</span>}
                  </div>
                </div>

                {/* Limites */}
                <div className="mb-4 space-y-1 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Usuários</span>
                    <span className="font-medium text-foreground">{formatarLimite(limites.usuarios)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Funis</span>
                    <span className="font-medium text-foreground">{formatarLimite(limites.funis)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Soluções</span>
                    <span className="font-medium text-foreground">{formatarLimite(limites.solucoes)}</span>
                  </div>
                </div>

                {/* Módulos incluídos */}
                <ul className="mb-6 flex-1 space-y-2">
                  {modulos.map((modulo) => {
                    const novo = isNovo(modulo)
                    return (
                      <li key={modulo} className={`flex items-center gap-2 text-xs ${novo ? 'font-semibold text-accent' : 'text-foreground'}`}>
                        <Check className={`size-3.5 shrink-0 ${novo ? 'text-accent' : 'text-primary'}`} aria-hidden />
                        {MODULO_LABEL[modulo]}
                      </li>
                    )
                  })}
                </ul>

                {/* CTA */}
                {isAtual && (
                  <button
                    disabled
                    type="button"
                    className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-70 cursor-not-allowed"
                  >
                    Plano atual
                  </button>
                )}
                {isUpgrade && (
                  <button
                    disabled
                    type="button"
                    title="Em breve"
                    className="flex w-full items-center justify-center rounded-xl bg-sidebar-primary px-4 py-2.5 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
                  >
                    Upgrade para {cfg.label}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Form de assinatura — trial, suspenso, cancelado */}
        {(['trial', 'suspenso', 'cancelado'] as StatusEmpresa[]).includes(status) && (
          <AssinaturaForm />
        )}

        {/* Voltar ao app (só se tiver acesso) */}
        {temAcesso && (
          <div className="text-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar ao app
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Dúvidas? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  )
}
