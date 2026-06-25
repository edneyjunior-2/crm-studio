import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, HardHat, Building2, User, MapPin, Pencil, CalendarDays, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ObraAcoes } from './obra-acoes'
import { ObrasDetalheTabs } from './obras-detalhe-tabs'

interface PageProps {
  params: Promise<{ id: string }>
}

function fmt(data: string | null): string {
  if (!data) return '—'
  const [y, m, d] = data.slice(0, 10).split('-')
  if (!y || !m || !d) return data
  return `${d}/${m}/${y}`
}

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

const STATUS_LABEL: Record<string, string> = {
  orcamento:    'Orçamento',
  em_andamento: 'Em andamento',
  pausada:      'Pausada',
  concluida:    'Concluída',
  cancelada:    'Cancelada',
}
const STATUS_CLASS: Record<string, string> = {
  orcamento:    'bg-muted text-muted-foreground',
  em_andamento: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  pausada:      'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  concluida:    'bg-green-500/10 text-green-700 dark:text-green-400',
  cancelada:    'bg-red-500/10 text-red-600 dark:text-red-400',
}
const TIPO_LABEL: Record<string, string> = {
  residencial: 'Residencial', comercial: 'Comercial', industrial: 'Industrial',
  infraestrutura: 'Infraestrutura', reforma: 'Reforma', outro: 'Outro',
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

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

export default async function ObraDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: obra, error } = await supabase
    .from('obras')
    .select('*, clientes(id, razao_social), profiles!responsavel_id(id, full_name)')
    .eq('id', id)
    .single()

  if (error || !obra) notFound()

  const [
    { data: etapas },
    { data: medicoes },
    { data: perfil },
    { data: membros },
    { data: equipeRaw },
    { data: colaboradoresRaw },
  ] = await Promise.all([
    supabase.from('obras_etapas').select('*').eq('obra_id', id).order('ordem').order('created_at'),
    supabase.from('obras_medicoes').select('*').eq('obra_id', id).order('numero_medicao'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase
      .from('obras_colaboradores')
      .select('*, colaboradores(id, nome, cargo)')
      .eq('obra_id', id)
      .order('created_at'),
    supabase
      .from('colaboradores')
      .select('id, nome, cargo')
      .eq('status', 'ativo')
      .order('nome', { ascending: true }),
  ])

  const equipe = (equipeRaw ?? []).map((e) => {
    const col = e.colaboradores as { id: string; nome: string; cargo: string | null } | null
    return {
      id:               e.id as string,
      colaborador_id:   e.colaborador_id as string,
      colaborador_nome: col?.nome ?? '—',
      funcao:           e.funcao as string | null,
      data_inicio:      e.data_inicio as string | null,
      ativo:            Boolean(e.ativo),
    }
  })

  const colaboradoresDisponiveis = (colaboradoresRaw ?? []).map((c) => ({
    id:    c.id as string,
    nome:  c.nome as string,
    cargo: c.cargo as string | null,
  }))

  const podeExcluir = perfil?.role === 'admin'

  const clienteRaw  = obra.clientes as unknown
  const respRaw     = (obra as Record<string, unknown>)['profiles!responsavel_id'] as unknown
  const clienteNome = (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null
  const clienteId   = (clienteRaw as { id?: string } | null)?.id ?? null
  const respNome    = (respRaw as { full_name?: string } | null)?.full_name ?? null

  // Progresso: % das etapas concluídas
  const totalEtapas     = (etapas ?? []).length
  const etapasConcluidas = (etapas ?? []).filter((e) => e.status === 'concluida').length
  const progresso       = totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/obras"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Obras
        </Link>
        <Link
          href={`/obras/${id}/editar`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Pencil className="size-3.5" />
          Editar
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <HardHat className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{obra.nome as string}</p>
              {obra.tipo && (
                <p className="text-sm text-muted-foreground">{TIPO_LABEL[obra.tipo as string] ?? obra.tipo as string}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[obra.status as string] ?? 'bg-muted text-muted-foreground'}`}>
              {STATUS_LABEL[obra.status as string] ?? obra.status as string}
            </span>
            <ObraAcoes obraId={id} statusAtual={obra.status as string} podeExcluir={podeExcluir} />
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Valor do contrato" value={fmtBRL(obra.valor_contrato as number | null)} accent />
          <Kpi label="Progresso" value={progresso != null ? `${progresso}%` : '—'} sub={totalEtapas > 0 ? `${etapasConcluidas}/${totalEtapas} etapas` : undefined} />
          <Kpi label="Início" value={fmt(obra.data_inicio as string | null)} />
          <Kpi label="Previsão de término" value={fmt(obra.data_previsao_termino as string | null)} />
        </div>

        {/* Grid de info */}
        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {clienteNome && clienteId ? (
            <Link href={`/clientes/${clienteId}`} className="group -m-1 flex items-start gap-2 rounded-lg p-1 transition-colors hover:bg-accent">
              <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                <p className="truncate text-sm text-foreground group-hover:text-primary">{clienteNome}</p>
              </div>
            </Link>
          ) : clienteNome ? (
            <InfoItem icon={Building2} label="Cliente" value={clienteNome} />
          ) : null}
          {respNome && <InfoItem icon={User} label="Responsável" value={respNome} />}
          {(obra.cidade || obra.estado) && (
            <InfoItem icon={MapPin} label="Localização" value={[obra.cidade, obra.estado].filter(Boolean).join(', ')} />
          )}
          {obra.endereco && <InfoItem icon={MapPin} label="Endereço" value={obra.endereco as string} />}
          {obra.art_numero && <InfoItem icon={FileText} label="ART / RRT" value={obra.art_numero as string} />}
          {obra.data_conclusao && <InfoItem icon={CalendarDays} label="Concluída em" value={fmt(obra.data_conclusao as string)} />}
        </div>

        {obra.descricao && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Observações</p>
            <p className="mt-1 text-sm text-foreground">{obra.descricao as string}</p>
          </div>
        )}
      </div>

      {/* Abas: Etapas | Medições */}
      <ObrasDetalheTabs
        obraId={id}
        etapas={(etapas ?? []).map((e) => ({
          id:             e.id,
          nome:           e.nome as string,
          descricao:      e.descricao as string | null,
          percentual_obra: e.percentual_obra as number | null,
          valor:          e.valor as number | null,
          status:         e.status as string,
          data_previsao:  e.data_previsao as string | null,
          data_conclusao: e.data_conclusao as string | null,
          ordem:          e.ordem as number,
        }))}
        medicoes={(medicoes ?? []).map((m) => ({
          id:             m.id,
          numero_medicao: m.numero_medicao as number,
          descricao:      m.descricao as string,
          percentual:     m.percentual as number | null,
          valor:          m.valor as number | null,
          data_medicao:   m.data_medicao as string | null,
          status:         m.status as string,
          observacoes:    m.observacoes as string | null,
        }))}
        membros={(membros ?? []).map((m) => ({ id: m.id, nome: m.full_name as string }))}
        podeExcluir={podeExcluir}
        equipe={equipe}
        colaboradoresDisponiveis={colaboradoresDisponiveis}
      />
    </div>
  )
}
