import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calculator, MapPin, Truck, IdCard, Building2, AlertTriangle, ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CotacaoAcoes } from './cotacao-acoes'
import { GerarNegocioButton } from './gerar-negocio-button'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<string, string> = {
  rascunho:  'Rascunho',
  enviada:   'Enviada',
  aprovada:  'Aprovada',
  em_viagem: 'Em viagem',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<string, string> = {
  rascunho:  'bg-muted text-muted-foreground',
  enviada:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  aprovada:  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  em_viagem: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  concluida: 'bg-green-500/10 text-green-700 dark:text-green-400',
  cancelada: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const TIPO_CARGA_LABEL: Record<string, string> = {
  geral:          'Carga geral',
  granel_solido:  'Granel sólido',
  granel_liquido: 'Granel líquido',
  frigorificada:  'Frigorificada',
  perigosa:       'Perigosa',
  neogranel:      'Neogranel',
  conteinerizada: 'Conteinerizada',
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}

export default async function CotacaoDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cotacao, error } = await supabase
    .from('frete_cotacoes')
    .select(`
      *,
      clientes(id, razao_social),
      veiculo:frete_veiculos(id, placa, tipo),
      motorista:frete_motoristas(id, nome)
    `)
    .eq('id', id)
    .single()

  if (error || !cotacao) notFound()

  const clienteRaw    = cotacao.clientes as unknown
  const veiculoRaw     = cotacao.veiculo as unknown
  const motoristaRaw   = cotacao.motorista as unknown
  const clienteNome    = (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null
  const veiculoPlaca   = (veiculoRaw as { placa?: string } | null)?.placa ?? null
  const motoristaNome  = (motoristaRaw as { nome?: string } | null)?.nome ?? null

  const valorPiso      = cotacao.valor_piso_antt as number | null
  const valorNegociado = cotacao.valor_negociado as number | null
  const abaixoPiso      = valorNegociado != null && valorPiso != null && valorNegociado < valorPiso
  const valorPrincipal  = valorNegociado ?? valorPiso

  const negocioId = cotacao.negocio_id as string | null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/frete/cotacoes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Cotações
        </Link>
        <CotacaoAcoes cotacaoId={id} statusAtual={cotacao.status as string} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Calculator className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {cotacao.origem as string} → {cotacao.destino as string}
              </p>
              <p className="text-sm text-muted-foreground">
                {TIPO_CARGA_LABEL[cotacao.tipo_carga as string] ?? cotacao.tipo_carga as string} · Tabela {cotacao.tabela_antt as string}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[cotacao.status as string] ?? 'bg-muted text-muted-foreground'}`}>
            {STATUS_LABEL[cotacao.status as string] ?? cotacao.status as string}
          </span>
        </div>

        {/* KPIs de valor */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Piso mínimo ANTT" value={valorPiso != null ? BRL.format(valorPiso) : '—'} />
          <Kpi label="Valor negociado" value={valorNegociado != null ? BRL.format(valorNegociado) : '—'} accent />
          <Kpi label="Distância" value={`${cotacao.distancia_km as number} km`} />
        </div>

        {abaixoPiso && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            Valor negociado abaixo do piso mínimo ANTT calculado ({BRL.format(valorPiso as number)}).
          </div>
        )}

        {/* Grid de info */}
        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {clienteNome && <InfoItem icon={Building2} label="Cliente" value={clienteNome} />}
          {veiculoPlaca && <InfoItem icon={Truck} label="Veículo" value={veiculoPlaca} />}
          {motoristaNome && <InfoItem icon={IdCard} label="Motorista" value={motoristaNome} />}
          <InfoItem icon={MapPin} label="Rota" value={`${cotacao.origem as string} → ${cotacao.destino as string}`} />
        </div>

        {cotacao.observacoes && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Observações</p>
            <p className="mt-1 text-sm text-foreground">{cotacao.observacoes as string}</p>
          </div>
        )}

        {valorPrincipal == null && (
          <p className="mt-4 text-xs text-muted-foreground">
            Nenhum valor calculado ainda para esta cotação.
          </p>
        )}
      </div>

      {/* Negócio no pipeline */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Negócio no pipeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {negocioId
              ? 'Esta cotação já gerou um negócio no pipeline de vendas.'
              : 'Gere um negócio no pipeline a partir desta cotação para acompanhar o fechamento.'}
          </p>
        </div>
        {/* ponytail: /pipeline não lê ?negocio= (não existe destaque/scroll pro
            negócio específico) — o link vai só pra tela geral do funil, sem
            prometer um deep-link que o pipeline não implementa. */}
        {negocioId ? (
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ver no pipeline
            <ExternalLink className="size-3.5" />
          </Link>
        ) : (
          <GerarNegocioButton cotacaoId={id} />
        )}
      </div>
    </div>
  )
}
