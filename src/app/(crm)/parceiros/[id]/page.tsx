import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  CalendarCheck,
  FileText,
  Pencil,
  Percent,
  UserCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { ParceiroForm } from '@/components/crm/parceiros/parceiro-form'
import { ContratoUpload } from '@/components/crm/parceiros/contrato-upload'
import type { Parceiro } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
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

export default async function ParceiroDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canEdit = profile?.role === 'admin' || profile?.role === 'socio'

  const [{ data, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('parceiros')
      .select('*, responsavel:profiles!responsavel_id(full_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
  ])

  if (error || !data) notFound()

  const parceiro = data as Parceiro
  const profilesList = (profiles ?? []) as { id: string; full_name: string }[]
  const responsavelNome = (data as { responsavel?: { full_name: string } | null }).responsavel?.full_name ?? '—'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/parceiros" />}
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{parceiro.nome}</h2>
            {parceiro.empresa && (
              <span className="text-sm text-muted-foreground">{parceiro.empresa}</span>
            )}
          </div>
        </div>

        {canEdit && (
          <ParceiroForm
            parceiro={parceiro}
            profiles={profilesList}
            currentUserId={user.id}
            trigger={
              <Button variant="outline">
                <Pencil className="size-4" />
                Editar Parceiro
              </Button>
            }
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Informações do parceiro
            </h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoField
                icon={<Building2 className="size-4" />}
                label="Empresa"
                value={parceiro.empresa}
              />
              <InfoField
                icon={<UserCircle className="size-4" />}
                label="Responsável"
                value={responsavelNome}
              />
              <InfoField
                icon={<Mail className="size-4" />}
                label="E-mail"
                value={parceiro.contato_email}
              />
              <InfoField
                icon={<Phone className="size-4" />}
                label="Telefone"
                value={parceiro.contato_telefone}
              />
              <InfoField
                icon={<Percent className="size-4" />}
                label="Comissão"
                value={
                  parceiro.comissao_percentual != null
                    ? `${parceiro.comissao_percentual}%`
                    : null
                }
              />
            </dl>
          </div>

          {parceiro.observacoes && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Observações</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {parceiro.observacoes}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Contrato</h3>
              <div className="flex items-center gap-2">
                {parceiro.contrato_assinado ? (
                  <StatusBadge variant="contrato_assinado">
                    Contrato Assinado
                  </StatusBadge>
                ) : (
                  <StatusBadge variant="sem_contrato">
                    Sem Contrato
                  </StatusBadge>
                )}
                {parceiro.contrato_assinado && parceiro.data_contrato && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarCheck className="size-3.5" />
                    <span>{formatDate(parceiro.data_contrato)}</span>
                  </div>
                )}
              </div>
            </div>

            {parceiro.contrato_url ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-3.5 shrink-0" />
                  <span>Arquivo enviado</span>
                </div>
                <ContratoUpload
                  parceiroId={parceiro.id}
                  contratoUrl={parceiro.contrato_url}
                  contratoNome={parceiro.contrato_nome}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Nenhum contrato enviado ainda.</p>
                <ContratoUpload
                  parceiroId={parceiro.id}
                  contratoUrl={null}
                  contratoNome={null}
                />
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Resumo</h3>
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-muted-foreground">Responsável</dt>
                <dd className="text-sm text-foreground">{responsavelNome}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-muted-foreground">Status do contrato</dt>
                <dd>
                  {parceiro.contrato_assinado ? (
                    <StatusBadge variant="contrato_assinado">
                      Assinado
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="pendente">
                      Pendente
                    </StatusBadge>
                  )}
                </dd>
              </div>
              {parceiro.data_contrato && (
                <div className="flex flex-col gap-1">
                  <dt className="text-xs font-medium text-muted-foreground">Data do contrato</dt>
                  <dd className="text-sm text-foreground">{formatDate(parceiro.data_contrato)}</dd>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-muted-foreground">Arquivo</dt>
                <dd className="text-sm text-foreground">
                  {parceiro.contrato_nome ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              {parceiro.comissao_percentual != null && (
                <div className="flex flex-col gap-1">
                  <dt className="text-xs font-medium text-muted-foreground">Comissão</dt>
                  <dd>
                    <StatusBadge variant="comissao">
                      {parceiro.comissao_percentual}%
                    </StatusBadge>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
