/**
 * Página de upgrade de módulo.
 * Fora do grupo (crm) → acessível sem loop.
 * Lê ?modulo=<slug>, descobre o menor plano que inclui o módulo e exibe CTA.
 */
import { getAuthUser } from '@/lib/auth'
import { MODULOS, MODULOS_POR_PLANO, type Modulo } from '@/lib/modulos'
import type { PlanoEmpresa } from '@/lib/auth'
import { Lock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

// Ordem crescente de planos (do menor para o maior)
const PLANO_ORDER: PlanoEmpresa[] = ['free', 'starter', 'pro', 'business']

const planoLabel: Record<PlanoEmpresa, string> = {
  free:       'Free',
  trial:      'Trial',
  interno:    'Interno',
  starter:    'Starter',
  pro:        'Pro',
  business:   'Business',
  // advocacia/engenharia não entram na escada de upgrade (PLANO_ORDER) — fora
  // do escopo desta página — mas o Record precisa das duas chaves (spec
  // planos-verticais-no-checkout.md ampliou PlanoEmpresa em src/lib/auth.ts).
  advocacia:  'Advocacia',
  engenharia: 'Engenharia e Obras',
  frete:      'Frete e Logística',
}

const moduloLabel: Record<Modulo, string> = {
  pipeline:     'Pipeline',
  clientes:     'Clientes',
  solucoes:     'Soluções',
  parceiros:    'Parceiros',
  financeiro:   'Financeiro',
  comissoes:    'Comissões',
  fluxos:       'Fluxos',
  calendario:   'Calendário',
  contratos:    'Contratos',
  automacoes:   'Automações',
  estoque:      'Estoque',
  rh:           'RH',
  processos:    'Processos Jurídicos',
  obras:        'Obras e Construção Civil',
  frete:        'Frete e Logística',
  atendimentos: 'Atendimentos WhatsApp',
  sdr:          'Agente SDR (WhatsApp IA)',
}

// Módulos que estarão disponíveis no futuro (em breve)
const MODULOS_EM_BREVE: Modulo[] = []

/**
 * Encontra o menor plano que inclui o módulo.
 * Retorna null se o módulo não existir em nenhum plano (add-on em breve).
 */
function menorPlanoParaModulo(modulo: Modulo): PlanoEmpresa | null {
  for (const plano of PLANO_ORDER) {
    if (MODULOS_POR_PLANO[plano].includes(modulo)) {
      return plano
    }
  }
  return null
}

interface PageProps {
  searchParams: Promise<{ modulo?: string }>
}

export default async function UpgradePage({ searchParams }: PageProps) {
  const params = await searchParams
  const moduloSlug = params.modulo

  // Valida se é um slug de módulo conhecido
  const modulo = (MODULOS as readonly string[]).includes(moduloSlug ?? '')
    ? (moduloSlug as Modulo)
    : null

  const { plano: planoAtual } = await getAuthUser()

  if (!modulo) {
    // Slug desconhecido ou não informado
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <span className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
            CRM Studio<span className="text-sidebar-primary">.</span>
          </span>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <Lock className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden />
            <h1 className="mb-2 text-xl font-bold text-foreground">Módulo não encontrado</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Não foi possível identificar o módulo solicitado.
            </p>
            <Link
              href="/assinatura"
              className="inline-flex items-center gap-2 rounded-xl bg-sidebar-primary px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Ver planos
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const emBreve = MODULOS_EM_BREVE.includes(modulo)
  const menorPlano = menorPlanoParaModulo(modulo)
  const nomeModulo = moduloLabel[modulo] ?? modulo

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <span className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
            CRM Studio<span className="text-sidebar-primary">.</span>
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="space-y-6">
            {/* Ícone e título */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-sidebar-primary/10">
                <Lock className="size-7 text-sidebar-primary" aria-hidden />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                {nomeModulo}
              </h1>
            </div>

            {emBreve ? (
              /* Módulo em breve */
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <p className="text-sm font-medium text-foreground">Em breve</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Este módulo ainda não está disponível. Em breve será incluído nos planos do CRM Studio.
                </p>
              </div>
            ) : menorPlano ? (
              /* Módulo disponível num plano superior */
              <>
                <div className="rounded-lg border border-sidebar-primary/30 bg-sidebar-primary/10 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Disponível no plano
                  </p>
                  <p className="mt-1 text-2xl font-bold text-sidebar-primary">
                    {planoLabel[menorPlano]}
                  </p>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Seu plano atual é{' '}
                  <span className="font-medium text-foreground">{planoLabel[planoAtual]}</span>.{' '}
                  Faça upgrade para acessar <span className="font-medium text-foreground">{nomeModulo}</span>.
                </div>
              </>
            ) : (
              /* Módulo não existe em nenhum plano padrão (add-on) */
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                <p className="text-sm font-medium text-foreground">Disponível como add-on</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Este módulo está disponível como um complemento. Entre em contato para mais informações.
                </p>
              </div>
            )}

            {/* CTAs */}
            <div className="space-y-3">
              <Link
                href="/assinatura"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sidebar-primary px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Ver planos
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/dashboard"
                className="flex w-full items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Voltar ao dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
