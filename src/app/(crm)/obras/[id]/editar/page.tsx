import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EditarObraForm } from './editar-obra-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditarObraPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: obra, error }, { data: clientes }, { data: profiles }] = await Promise.all([
    supabase.from('obras').select('id, nome, tipo, status, valor_contrato, data_inicio, data_previsao_termino, endereco, cidade, estado, art_numero, descricao, cliente_id, responsavel_id').eq('id', id).single(),
    supabase.from('clientes').select('id, razao_social').order('razao_social'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  if (error || !obra) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/obras/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar à obra
        </Link>
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Editar obra
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{obra.nome as string}</p>
      </div>

      <EditarObraForm
        obra={{
          id:                    obra.id,
          nome:                  obra.nome as string,
          tipo:                  obra.tipo as string | null,
          status:                obra.status as string,
          valor_contrato:        obra.valor_contrato as number | null,
          data_inicio:           obra.data_inicio as string | null,
          data_previsao_termino: obra.data_previsao_termino as string | null,
          endereco:              obra.endereco as string | null,
          cidade:                obra.cidade as string | null,
          estado:                obra.estado as string | null,
          art_numero:            obra.art_numero as string | null,
          descricao:             obra.descricao as string | null,
          cliente_id:            obra.cliente_id as string | null,
          responsavel_id:        obra.responsavel_id as string | null,
        }}
        clientes={(clientes ?? []).map((c) => ({ id: c.id, razao_social: c.razao_social }))}
        responsaveis={(profiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
      />
    </div>
  )
}
