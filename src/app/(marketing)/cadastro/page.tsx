import type { Metadata } from 'next'
import { CadastroForm } from '@/components/marketing/cadastro-form'
import { planoValido } from '@/lib/planos'

export const metadata: Metadata = {
  title: 'Criar conta — CRM Studio',
  description: 'Crie sua conta no CRM Studio e comece a gerenciar suas vendas. 14 dias grátis, sem cartão.',
}

interface CadastroPageProps {
  searchParams: Promise<{ plano?: string }>
}

export default async function CadastroPage({ searchParams }: CadastroPageProps) {
  const { plano: planoParam } = await searchParams
  const plano = planoValido(planoParam)

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm">
        <CadastroForm plano={plano} />
      </div>
    </div>
  )
}
