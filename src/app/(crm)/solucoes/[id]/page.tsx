import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Download,
  FileText,
  Percent,
  Pencil,
  TrendingUp,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SolucaoForm } from '@/components/crm/solucoes/solucao-form'
import { SolucaoDeleteButton } from '@/components/crm/solucoes/solucao-delete-button'
import { ClientesDaSolucao } from '@/components/crm/solucoes/clientes-da-solucao'
import type { Solucao, Negocio } from '@/types'
import { listarEstagios } from '@/lib/pipeline-estagios'
import { mapaEstagios, corPorTipo } from '@/lib/estagios-ui'
import { listarClientesDaSolucao } from '@/lib/solucao-clientes'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SolucaoDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const [solucaoResult, negociosResult, estagios, clientes] = await Promise.all([
    supabase.from('solucoes').select('*').eq('id', id).single(),
    supabase
      .from('negocios')
      .select('id, titulo, estagio, valor_estimado, data_previsao_fechamento, created_at, updated_at, cliente_id, solucao_id, responsavel_id, probabilidade, observacoes')
      .eq('solucao_id', id)
      .order('created_at', { ascending: false }),
    listarEstagios(),
    listarClientesDaSolucao(id),
  ])

  const mapa = mapaEstagios(estagios)

  if (solucaoResult.error || !solucaoResult.data) {
    notFound()
  }

  const solucao = solucaoResult.data as Solucao
  const negocios = (negociosResult.data ?? []) as Negocio[]

  const comissaoFormatada =
    solucao.comissao_percentual !== null
      ? new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(solucao.comissao_percentual) + '%'
      : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/solucoes" />}
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">
                {solucao.nome}
              </h2>
              <Badge variant={solucao.ativo ? 'default' : 'outline'}>
                {solucao.ativo ? 'Ativa' : 'Inativa'}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Users className="size-3" />
                {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
              </Badge>
            </div>
            {solucao.empresa_representada && (
              <p className="text-sm text-muted-foreground">
                {solucao.empresa_representada}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/solucoes/${solucao.id}/pdf`} target="_blank" />}
          >
            <Download className="size-4" />
            Exportar PDF
          </Button>
          {isAdmin && (
            <>
              <SolucaoForm
                solucao={solucao}
                trigger={
                  <Button variant="outline">
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                }
              />
              <SolucaoDeleteButton id={solucao.id} nome={solucao.nome} />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Informações da solução
            </h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoField
                icon={<Building2 className="size-4" />}
                label="Empresa representada"
                value={solucao.empresa_representada}
              />
              <InfoField
                icon={<Percent className="size-4" />}
                label="Comissão"
                value={comissaoFormatada}
              />
            </dl>
          </div>

          {solucao.descricao && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                Descrição
              </h3>
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {solucao.descricao}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-1 flex flex-col gap-4">
          <ClientesDaSolucao clientes={clientes} />

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Negócios vinculados
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
                      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${corPorTipo(mapa[negocio.estagio]?.tipo ?? 'aberto').badge}`}
                    >
                      {mapa[negocio.estagio]?.nome ?? negocio.estagio}
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
