import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ShieldCheck, CreditCard } from 'lucide-react'
import { getAuthUser } from '@/lib/auth'
import { PLANO_LABEL, PRECO_POR_PLANO, type PlanoVendavel } from '@/lib/planos'
import { ContinuarButton } from './continuar-button'

export const metadata: Metadata = {
  title: 'Confirme seu cartão — CRM Studio',
  description: 'Confirme seu cartão para iniciar os 14 dias grátis do CRM Studio.',
}

export default async function CadastroPagamentoPage() {
  const { status, empresaId, supabase } = await getAuthUser()

  // Só quem está aguardando confirmação de cartão vê esta página. Qualquer
  // outro status já passou por aqui (ou nunca precisou) — manda pro dashboard,
  // que redireciona pra onde já redirecionaria hoje (ver (crm)/layout.tsx).
  if (status !== 'pendente_cartao') {
    redirect('/dashboard')
  }

  // Plano escolhido no /cadastro (empresas.plano_contratado). NULL (empresa
  // anterior a essa mudança) cai em 'starter' — mesmo fallback do checkout em
  // cadastro/pagamento/actions.ts (spec planos-verticais-no-checkout.md).
  let plano: PlanoVendavel = 'starter'
  if (empresaId) {
    const { data } = await supabase
      .from('empresas')
      .select('plano_contratado')
      .eq('id', empresaId)
      .maybeSingle()
    plano = (data?.plano_contratado as PlanoVendavel | null) ?? 'starter'
  }
  const precoFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(PRECO_POR_PLANO[plano])

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-sidebar-primary/10">
            <CreditCard className="size-6 text-sidebar-primary" aria-hidden />
          </div>
        </div>

        <h1 className="text-center text-xl font-bold tracking-tight text-foreground">
          Confirme seu cartão para começar
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Seus 14 dias grátis começam assim que o cartão for confirmado. Nada é
          cobrado agora — a primeira cobrança só acontece ao final do teste,
          e você pode cancelar antes disso sem custo.
        </p>

        <div className="mt-5 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">Plano selecionado</p>
          <p className="text-base font-semibold text-foreground">
            {PLANO_LABEL[plano]} — {precoFmt}/mês
          </p>
        </div>

        <div className="mt-6">
          <ContinuarButton />
        </div>

        <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            O pagamento é processado numa página segura do Asaas. Seus dados de
            cartão nunca passam pelos nossos servidores.
          </p>
        </div>
      </div>
    </div>
  )
}
