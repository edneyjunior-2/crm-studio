import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EditarMotoristaForm } from './editar-motorista-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditarMotoristaPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: motorista, error } = await supabase
    .from('frete_motoristas')
    .select('id, nome, cpf, cnh_numero, cnh_categoria, cnh_validade, vinculo, rntrc, observacoes, ativo')
    .eq('id', id)
    .single()

  if (error || !motorista) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/frete/motoristas/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar ao motorista
      </Link>

      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Editar motorista
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{motorista.nome as string}</p>
      </div>

      <EditarMotoristaForm
        motorista={{
          id:            motorista.id,
          nome:          motorista.nome as string,
          cpf:           motorista.cpf as string,
          cnh_numero:    motorista.cnh_numero as string,
          cnh_categoria: motorista.cnh_categoria as string,
          cnh_validade:  motorista.cnh_validade as string | null,
          vinculo:       motorista.vinculo as string,
          rntrc:         motorista.rntrc as string | null,
          observacoes:   motorista.observacoes as string | null,
          ativo:         motorista.ativo as boolean,
        }}
      />
    </div>
  )
}
