import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, IdCard, FileText, CalendarDays, Briefcase, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { MotoristaAcoes } from './motorista-acoes'
import { CnhUploadSection } from './cnh-upload-section'

interface PageProps {
  params: Promise<{ id: string }>
}

const VINCULO_LABEL: Record<string, string> = {
  autonomo: 'Autônomo',
  clt:      'CLT',
}

function fmt(data: string | null): string {
  if (!data) return '—'
  const [y, m, d] = data.slice(0, 10).split('-')
  if (!y || !m || !d) return data
  return `${d}/${m}/${y}`
}

/** Compara datas locais (getFullYear/getMonth/getDate) — nunca .toISOString() (CLAUDE.md). */
function diasAteVencimento(validade: string | null): number | null {
  if (!validade) return null
  const [ano, mes, dia] = validade.slice(0, 10).split('-').map(Number)
  const dataValidade = new Date(ano, (mes ?? 1) - 1, dia ?? 1)
  const hoje = new Date()
  const hojeLocal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((dataValidade.getTime() - hojeLocal.getTime()) / 86400000)
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}

export default async function MotoristaDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: motorista, error } = await supabase
    .from('frete_motoristas')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !motorista) notFound()

  const { role } = await getAuthUser()
  const validade = motorista.cnh_validade as string | null
  const dias = diasAteVencimento(validade)
  const cnhVencida  = dias != null && dias < 0
  const cnhVencendo = dias != null && dias >= 0 && dias <= 30

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/frete/motoristas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Motoristas
        </Link>
        <MotoristaAcoes motoristaId={id} podeExcluir={role === 'admin'} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <IdCard className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{motorista.nome as string}</p>
              <p className="text-sm text-muted-foreground">{VINCULO_LABEL[motorista.vinculo as string] ?? motorista.vinculo as string}</p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              motorista.ativo ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'
            }`}
          >
            {motorista.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        {(cnhVencida || cnhVencendo) && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              cnhVencida
                ? 'border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400'
                : 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400'
            }`}
          >
            <AlertTriangle className="size-4 shrink-0" />
            {cnhVencida
              ? `CNH vencida em ${fmt(validade)}.`
              : `CNH vence em ${fmt(validade)} (${dias} dia${dias === 1 ? '' : 's'}).`}
          </div>
        )}

        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem icon={FileText} label="CPF" value={motorista.cpf as string} />
          <InfoItem icon={FileText} label="CNH nº" value={`${motorista.cnh_numero} (categoria ${motorista.cnh_categoria})`} />
          <InfoItem icon={CalendarDays} label="Validade CNH" value={fmt(validade)} />
          {motorista.rntrc && <InfoItem icon={Briefcase} label="RNTRC" value={motorista.rntrc as string} />}
        </div>

        {motorista.observacoes && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Observações</p>
            <p className="mt-1 text-sm text-foreground">{motorista.observacoes as string}</p>
          </div>
        )}
      </div>

      <CnhUploadSection motoristaId={id} />
    </div>
  )
}
