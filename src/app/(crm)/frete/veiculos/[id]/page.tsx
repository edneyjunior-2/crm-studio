import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Truck, Hash, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { VeiculoAcoes } from './veiculo-acoes'

interface PageProps {
  params: Promise<{ id: string }>
}

const TIPO_LABEL: Record<string, string> = {
  toco:     'Toco',
  truck:    'Truck',
  carreta:  'Carreta',
  bitrem:   'Bitrem',
  rodotrem: 'Rodotrem',
  outro:    'Outro',
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

export default async function VeiculoDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: veiculo, error } = await supabase
    .from('frete_veiculos')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !veiculo) notFound()

  const { role } = await getAuthUser()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/frete/veiculos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Veículos
        </Link>
        <VeiculoAcoes veiculoId={id} podeExcluir={role === 'admin'} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Truck className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{veiculo.placa as string}</p>
              <p className="text-sm text-muted-foreground">{TIPO_LABEL[veiculo.tipo as string] ?? veiculo.tipo as string}</p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              veiculo.ativo ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'
            }`}
          >
            {veiculo.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {veiculo.eixos != null && <InfoItem icon={Hash} label="Eixos" value={String(veiculo.eixos)} />}
          {veiculo.rntrc && <InfoItem icon={FileText} label="RNTRC" value={veiculo.rntrc as string} />}
        </div>

        {veiculo.observacoes && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Observações</p>
            <p className="mt-1 text-sm text-foreground">{veiculo.observacoes as string}</p>
          </div>
        )}
      </div>
    </div>
  )
}
