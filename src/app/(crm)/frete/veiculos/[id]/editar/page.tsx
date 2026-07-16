import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EditarVeiculoForm } from './editar-veiculo-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditarVeiculoPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: veiculo, error } = await supabase
    .from('frete_veiculos')
    .select('id, placa, tipo, eixos, rntrc, observacoes, ativo')
    .eq('id', id)
    .single()

  if (error || !veiculo) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/frete/veiculos/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar ao veículo
      </Link>

      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Editar veículo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{veiculo.placa as string}</p>
      </div>

      <EditarVeiculoForm
        veiculo={{
          id:          veiculo.id,
          placa:       veiculo.placa as string,
          tipo:        veiculo.tipo as string,
          eixos:       veiculo.eixos as number | null,
          rntrc:       veiculo.rntrc as string | null,
          observacoes: veiculo.observacoes as string | null,
          ativo:       veiculo.ativo as boolean,
        }}
      />
    </div>
  )
}
