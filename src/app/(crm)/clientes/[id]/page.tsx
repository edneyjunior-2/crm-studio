import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  User,
  FileText,
  Tag,
  Pencil,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ClienteForm } from '@/components/crm/clientes/cliente-form'
import { ClienteDeleteButton } from '@/components/crm/clientes/cliente-delete-button'
import type { Cliente, Negocio } from '@/types'

const estagioLabel: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado (Ganho)',
  fechado_perdido: 'Fechado (Perdido)',
}

const estagioColor: Record<string, string> = {
  prospeccao: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  qualificacao: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  proposta: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  negociacao: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  fechado_ganho: 'bg-green-500/10 text-green-600 dark:text-green-400',
  fechado_perdido: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClienteDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [clienteResult, negociosResult] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', id).single(),
    supabase
      .from('negocios')
      .select('id, titulo, estagio, valor_estimado, data_previsao_fechamento, created_at, updated_at, cliente_id, solucao_id, responsavel_id, probabilidade, observacoes')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (clienteResult.error || !clienteResult.data) {
    notFound()
  }

  const cliente = clienteResult.data as Cliente
  const negocios = (negociosResult.data ?? []) as Negocio[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/clientes" />}
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {cliente.razao_social}
            </h2>
            {cliente.segmento && (
              <span className="text-sm text-muted-foreground">
                {cliente.segmento}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ClienteForm
            cliente={cliente}
            trigger={
              <Button variant="outline">
                <Pencil className="size-4" />
                Editar
              </Button>
            }
          />
          <ClienteDeleteButton id={cliente.id} razaoSocial={cliente.razao_social} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Informações da empresa
            </h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoField
                icon={<Building2 className="size-4" />}
                label="Razão Social"
                value={cliente.razao_social}
              />
              <InfoField
                icon={<FileText className="size-4" />}
                label="CNPJ"
                value={cliente.cnpj}
              />
              <InfoField
                icon={<Tag className="size-4" />}
                label="Segmento"
                value={cliente.segmento}
              />
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Contato
            </h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoField
                icon={<User className="size-4" />}
                label="Nome"
                value={cliente.contato_nome}
              />
              <InfoField
                icon={<Mail className="size-4" />}
                label="E-mail"
                value={cliente.contato_email}
              />
              <InfoField
                icon={<Phone className="size-4" />}
                label="Telefone"
                value={cliente.contato_telefone}
              />
            </dl>
          </div>

          {cliente.observacoes && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                Observações
              </h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {cliente.observacoes}
              </p>
            </div>
          )}
        </div>

        <div className="col-span-1 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Negócios
              </h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {negocios.length}
              </span>
            </div>

            {negocios.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <TrendingUp className="size-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  Nenhum negócio vinculado.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {negocios.map((negocio) => (
                  <li
                    key={negocio.id}
                    className="flex flex-col gap-1 rounded-lg border border-border p-3"
                  >
                    <span className="text-sm font-medium text-foreground line-clamp-1">
                      {negocio.titulo}
                    </span>
                    <span
                      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${estagioColor[negocio.estagio] ?? 'bg-muted text-muted-foreground'}`}
                    >
                      {estagioLabel[negocio.estagio] ?? negocio.estagio}
                    </span>
                    {negocio.valor_estimado != null && (
                      <span className="text-xs text-muted-foreground">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(negocio.valor_estimado)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="text-muted-foreground/60">{icon}</span>
        {label}
      </dt>
      <dd className="text-sm text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  )
}
