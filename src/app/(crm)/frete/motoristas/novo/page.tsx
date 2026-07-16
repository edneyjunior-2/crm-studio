import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NovoMotoristaForm } from './novo-motorista-form'

export default async function NovoMotoristaPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/frete/motoristas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Motoristas
      </Link>

      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Novo motorista
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre um motorista para a operação de frete.
        </p>
      </div>

      <NovoMotoristaForm />
    </div>
  )
}
