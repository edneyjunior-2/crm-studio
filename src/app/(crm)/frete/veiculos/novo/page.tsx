import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NovaVeiculoForm } from './nova-veiculo-form'

export default async function NovoVeiculoPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/frete/veiculos"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Veículos
      </Link>

      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Novo veículo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre um veículo da frota de frete.
        </p>
      </div>

      <NovaVeiculoForm />
    </div>
  )
}
