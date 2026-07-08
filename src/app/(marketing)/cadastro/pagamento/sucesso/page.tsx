import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { getAuthUser } from '@/lib/auth'
import { PollingConfirmacao } from './polling-confirmacao'
import { TrialIniciadoTracker } from './trial-iniciado-tracker'

export const metadata: Metadata = {
  title: 'Cartão confirmado — CRM Studio',
}

export default async function CadastroPagamentoSucessoPage() {
  // Lê o status atual — NUNCA seta status aqui. Quem libera o trial é sempre
  // o webhook do Asaas (SUBSCRIPTION_CREATED, ver src/app/api/asaas/webhook).
  // Confiar no redirect do Asaas pra liberar acesso seria fraude trivial:
  // qualquer um poderia acessar esta URL direto sem nunca ter preenchido
  // cartão. Esta página só lê e espera (polling), nunca decide.
  const { status } = await getAuthUser()
  const confirmado = status !== 'pendente_cartao'

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="size-6 text-green-600" aria-hidden />
          </div>
        </div>

        {confirmado ? (
          <>
            <TrialIniciadoTracker />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Cartão confirmado! Seu teste começou.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Você tem 14 dias grátis para explorar o CRM Studio. Nada foi
              cobrado agora — a primeira cobrança só acontece ao final do
              teste, e você pode cancelar antes disso sem custo.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-transform hover:bg-foreground/90 active:scale-[0.98]"
            >
              Ir para o Dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Confirmando seu cartão...
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos processando a confirmação com o Asaas. Isso normalmente
              leva só alguns segundos.
            </p>
            <PollingConfirmacao />
          </>
        )}
      </div>
    </div>
  )
}
