import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NegocioComRelacoes } from '@/types'
import { listarEstagios } from '@/lib/pipeline-estagios'
import { corPorTipo } from '@/lib/estagios-ui'
import type { EstagioPipeline, EstagioTipo } from '@/lib/estagios-ui'
import { NegocioCardActions } from './negocio-card-actions'
import { BotaoLembrete } from '@/components/crm/pipeline/botao-lembrete'
import { BotaoTimeline } from '@/components/crm/pipeline/negocio-timeline-dialog'

// ─── Formatadores ────────────────────────────────────────────────────────────

function formatBRL(valor: number | null): string {
  if (valor === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

/** YYYY-MM-DD seguro (sem toISOString) → "Junho de 2026" capitalizado. */
function formatMesAno(date: Date): string {
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDataLocal(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  // timestamptz: safe to use Date directly for display
  const d = new Date(isoString)
  return d.toLocaleDateString('pt-BR')
}

// ─── Agrupamento por mês ──────────────────────────────────────────────────────

/** Extrai a data de referência: data_fechamento > estagio_atualizado_em > updated_at */
function getDataReferencia(neg: NegocioComRelacoes): string {
  return neg.data_fechamento ?? neg.estagio_atualizado_em ?? neg.updated_at
}

/**
 * Chave YYYY-MM a partir de uma ISO string, usando getFullYear/Month para evitar
 * virada de UTC (ex.: 2026-06-01T03:00:00Z seria Maio em UTC-3 sem isso).
 */
function getMesAnoKey(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMesAnoLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  // new Date(year, month-1, 1) é sempre local → sem risco de virada de UTC
  return formatMesAno(new Date(year, month - 1, 1))
}

type GrupoMes = Map<string, NegocioComRelacoes[]>

function agruparPorMes(negocios: NegocioComRelacoes[]): { grupos: GrupoMes; chavesOrdenadas: string[] } {
  const grupos: GrupoMes = new Map()
  for (const neg of negocios) {
    const key = getMesAnoKey(getDataReferencia(neg))
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(neg)
  }
  const chavesOrdenadas = Array.from(grupos.keys()).sort((a, b) => b.localeCompare(a))
  return { grupos, chavesOrdenadas }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function HistoricoPerdidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, estagios] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single().then((r) => r.data),
    listarEstagios(),
  ])

  const estagiosPerdidos = estagios.filter((e) => e.tipo === 'perdido')
  const estagiosGanhos   = estagios.filter((e) => e.tipo === 'ganho')

  const slugsPerdidos = estagiosPerdidos.map((e) => e.slug)
  const slugsGanhos   = estagiosGanhos.map((e) => e.slug)
  const slugsFechamento = [...slugsPerdidos, ...slugsGanhos]

  // Negócios de MESES ANTERIORES ao corrente
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const isComercial = profile?.role === 'comercial'

  let todosNegocios: NegocioComRelacoes[] = []
  try {
    todosNegocios = await fetchAllRows<NegocioComRelacoes>((from, to) => {
      let q = supabase
        .from('negocios')
        .select(`
          *,
          clientes ( razao_social ),
          solucoes ( nome ),
          profiles ( full_name )
        `)
        .in('estagio', slugsFechamento.length > 0 ? slugsFechamento : ['__none__'])
        .or(
          `and(estagio_atualizado_em.not.is.null,estagio_atualizado_em.lt.${startOfMonth}),` +
          `and(estagio_atualizado_em.is.null,updated_at.lt.${startOfMonth})`
        )
        .order('estagio_atualizado_em', { ascending: false })
        .range(from, to)

      if (isComercial) q = q.eq('responsavel_id', user.id)
      return q
    })
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm text-destructive">
            Erro ao carregar histórico. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    )
  }

  // Mapa slug → etapa (para resolver nome/tipo dinamicamente no card)
  const mapaSlug = new Map<string, EstagioPipeline>()
  for (const e of estagios) mapaSlug.set(e.slug, e)

  const negociosPerdidos    = todosNegocios.filter((n) => slugsPerdidos.includes(n.estagio))
  const negociosContratados = todosNegocios.filter((n) => slugsGanhos.includes(n.estagio))

  return (
    <div className="flex flex-col gap-6">
      <Header />

      {/* ── Seção: Perdidos ─────────────────────────────────────────────── */}
      <Secao
        titulo="Perdidos"
        descricao="Negócios em etapas de perda (Inviável, Declinado etc.)"
        tipo="perdido"
        negocios={negociosPerdidos}
        mapaSlug={mapaSlug}
        emptyMsg="Nenhum negócio perdido ainda."
      />

      {/* ── Seção: Contratados ─────────────────────────────────────────── */}
      <Secao
        titulo="Contratados"
        descricao="Negócios ganhos e formalizados"
        tipo="ganho"
        negocios={negociosContratados}
        mapaSlug={mapaSlug}
        emptyMsg="Nenhum negócio contratado ainda."
      />
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
          Histórico de Fechados
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Negócios perdidos e contratados em meses anteriores, agrupados por mês de fechamento.
        </p>
      </div>
      <Link
        href="/pipeline"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
      >
        <ArrowLeft className="size-4" />
        Voltar ao Pipeline
      </Link>
    </div>
  )
}

interface SecaoProps {
  titulo: string
  descricao: string
  tipo: EstagioTipo
  negocios: NegocioComRelacoes[]
  mapaSlug: Map<string, EstagioPipeline>
  emptyMsg: string
}

function Secao({ titulo, descricao, tipo, negocios, mapaSlug, emptyMsg }: SecaoProps) {
  const cores = corPorTipo(tipo)

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-3 border-b border-border pb-2">
        <span className={cn('size-2 shrink-0 rounded-full', cores.dot)} />
        <div>
          <h3 className={cn('text-base font-semibold', cores.texto)}>{titulo}</h3>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {negocios.length} {negocios.length === 1 ? 'negócio' : 'negócios'}
        </span>
      </div>

      {negocios.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 py-10 text-center">
          <History className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{emptyMsg}</p>
        </div>
      ) : (
        <GruposPorMes negocios={negocios} mapaSlug={mapaSlug} />
      )}
    </div>
  )
}

function GruposPorMes({
  negocios,
  mapaSlug,
}: {
  negocios: NegocioComRelacoes[]
  mapaSlug: Map<string, EstagioPipeline>
}) {
  const { grupos, chavesOrdenadas } = agruparPorMes(negocios)

  return (
    <div className="flex flex-col gap-8">
      {chavesOrdenadas.map((chave) => {
        const itens = grupos.get(chave)!
        return (
          <section key={chave}>
            <div className="mb-3 flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                {getMesAnoLabel(chave)}
              </h4>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {itens.length} {itens.length === 1 ? 'negócio' : 'negócios'}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {itens.map((neg) => (
                <NegocioCard key={neg.id} negocio={neg} estagio={mapaSlug.get(neg.estagio)} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function NegocioCard({
  negocio,
  estagio,
}: {
  negocio: NegocioComRelacoes
  estagio: EstagioPipeline | undefined
}) {
  const dataRef = getDataReferencia(negocio)
  const tipo    = estagio?.tipo ?? 'aberto'
  const cores   = corPorTipo(tipo)
  const nomeEstagio = estagio?.nome ?? negocio.estagio
  const clienteNome = negocio.clientes?.razao_social ?? ''

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      {/* Coluna principal */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <BotaoTimeline negocioId={negocio.id} titulo={negocio.titulo}>
            <span className="text-sm font-semibold text-foreground leading-snug truncate">
              {negocio.titulo}
            </span>
          </BotaoTimeline>
          <Badge
            className={cn('shrink-0 text-[10px] px-1.5 py-0 border', cores.badge)}
          >
            {nomeEstagio}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {negocio.clientes?.razao_social && (
            <span>
              <span className="text-muted-foreground/50">Cliente:</span>{' '}
              {negocio.clientes.razao_social}
            </span>
          )}
          {negocio.solucoes?.nome && (
            <span>
              <span className="text-muted-foreground/50">Solução:</span>{' '}
              {negocio.solucoes.nome}
            </span>
          )}
          {negocio.profiles?.full_name && (
            <span>
              <span className="text-muted-foreground/50">Responsável:</span>{' '}
              {negocio.profiles.full_name}
            </span>
          )}
        </div>

        {negocio.motivo_perda && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="text-muted-foreground/50">Motivo:</span>{' '}
            {negocio.motivo_perda}
          </p>
        )}

        {/* Ações */}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <NegocioCardActions negocioId={negocio.id} negocioTitulo={negocio.titulo} />
          <BotaoLembrete negocioId={negocio.id} clienteNome={clienteNome} />
        </div>
      </div>

      {/* Coluna de valores */}
      <div className="flex shrink-0 flex-row gap-4 sm:flex-col sm:items-end sm:gap-1">
        <div className="text-sm font-semibold text-foreground tabular-nums">
          {formatBRL(negocio.valor_estimado)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDataLocal(dataRef)}
        </div>
      </div>
    </div>
  )
}
