'use client'

import { useMemo, useState } from 'react'
import { History, Search } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { NegocioComRelacoes } from '@/types'
import { corPorTipo } from '@/lib/estagios-ui'
import type { EstagioPipeline } from '@/lib/estagios-ui'
import { NegocioCardActions } from './negocio-card-actions'
import { BotaoLembrete } from '@/components/crm/pipeline/botao-lembrete'
import { BotaoTimeline } from '@/components/crm/pipeline/negocio-timeline-dialog'

// ponytail: `desqualificado` ainda não está em NegocioComRelacoes (src/types,
// fora da lane deste stream) — alias local só p/ este arquivo compilar.
type NegocioComDesq = NegocioComRelacoes & { desqualificado?: boolean | null }

// ─── Formatadores / helpers puros ────────────────────────────────────────────

function formatBRL(valor: number | null): string {
  if (valor === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

/** Data de exibição pt-BR sem virada de UTC (date pura YYYY-MM-DD parseada local). */
function formatDataLocal(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    const [y, m, d] = isoString.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR')
  }
  return new Date(isoString).toLocaleDateString('pt-BR')
}

function getDataReferencia(neg: NegocioComRelacoes): string {
  return neg.data_fechamento ?? neg.estagio_atualizado_em ?? neg.updated_at
}

function getMesAnoKey(isoString: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    const [y, m] = isoString.split('-').map(Number)
    return `${y}-${String(m).padStart(2, '0')}`
  }
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMesAnoLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function agruparPorMes(negocios: NegocioComRelacoes[]): { grupos: Map<string, NegocioComRelacoes[]>; chaves: string[] } {
  const grupos = new Map<string, NegocioComRelacoes[]>()
  for (const neg of negocios) {
    const key = getMesAnoKey(getDataReferencia(neg))
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(neg)
  }
  const chaves = Array.from(grupos.keys()).sort((a, b) => b.localeCompare(a))
  return { grupos, chaves }
}

/** minúsculo, sem acento — para busca tolerante. */
function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function casaBusca(neg: NegocioComRelacoes, termo: string): boolean {
  if (!termo) return true
  const alvo = norm(
    [
      neg.titulo,
      neg.clientes?.razao_social,
      neg.solucoes?.nome,
      neg.profiles?.full_name,
      neg.motivo_perda,
    ]
      .filter(Boolean)
      .join(' ')
  )
  return norm(termo)
    .split(/\s+/)
    .filter(Boolean)
    .every((palavra) => alvo.includes(palavra))
}

// ─── Componente principal ────────────────────────────────────────────────────

interface HistoricoViewProps {
  perdidos: NegocioComRelacoes[]
  ganhos: NegocioComRelacoes[]
  desqualificados: NegocioComDesq[]
  estagios: EstagioPipeline[]
}

export function HistoricoView({ perdidos, ganhos, desqualificados, estagios }: HistoricoViewProps) {
  const [busca, setBusca] = useState('')

  const mapaSlug = useMemo(() => {
    const m = new Map<string, EstagioPipeline>()
    for (const e of estagios) m.set(e.slug, e)
    return m
  }, [estagios])

  const perdidosFiltrados = useMemo(() => perdidos.filter((n) => casaBusca(n, busca)), [perdidos, busca])
  const ganhosFiltrados = useMemo(() => ganhos.filter((n) => casaBusca(n, busca)), [ganhos, busca])
  const desqualificadosFiltrados = useMemo(
    () => desqualificados.filter((n) => casaBusca(n, busca)),
    [desqualificados, busca]
  )

  return (
    <Tabs defaultValue="perdido">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="perdido">
            Perdidos
            <ContadorTab n={perdidosFiltrados.length} />
          </TabsTrigger>
          <TabsTrigger value="ganho">
            Ganhos
            <ContadorTab n={ganhosFiltrados.length} />
          </TabsTrigger>
          <TabsTrigger value="desqualificado">
            Desqualificados
            <ContadorTab n={desqualificadosFiltrados.length} />
          </TabsTrigger>
        </TabsList>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, título, solução…"
            className="pl-9"
            aria-label="Buscar no histórico"
          />
        </div>
      </div>

      <TabsContent value="perdido">
        <ListaNegocios
          negocios={perdidosFiltrados}
          mapaSlug={mapaSlug}
          emptyMsg={busca ? 'Nenhum negócio perdido encontrado para essa busca.' : 'Nenhum negócio perdido ainda.'}
        />
      </TabsContent>

      <TabsContent value="ganho">
        <ListaNegocios
          negocios={ganhosFiltrados}
          mapaSlug={mapaSlug}
          emptyMsg={busca ? 'Nenhum negócio ganho encontrado para essa busca.' : 'Nenhum negócio contratado ainda.'}
        />
      </TabsContent>

      <TabsContent value="desqualificado">
        <ListaNegocios
          negocios={desqualificadosFiltrados}
          mapaSlug={mapaSlug}
          desqualificado
          emptyMsg={busca ? 'Nenhum negócio desqualificado encontrado para essa busca.' : 'Nenhum negócio desqualificado ainda.'}
        />
      </TabsContent>
    </Tabs>
  )
}

function ContadorTab({ n }: { n: number }) {
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
      {n}
    </span>
  )
}

function ListaNegocios({
  negocios,
  mapaSlug,
  emptyMsg,
  desqualificado = false,
}: {
  negocios: NegocioComRelacoes[]
  mapaSlug: Map<string, EstagioPipeline>
  emptyMsg: string
  desqualificado?: boolean
}) {
  if (negocios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 py-12 text-center">
        <History className="size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{emptyMsg}</p>
      </div>
    )
  }

  const { grupos, chaves } = agruparPorMes(negocios)

  return (
    <div className="flex flex-col gap-8">
      {chaves.map((chave) => {
        const itens = grupos.get(chave)!
        return (
          <section key={chave}>
            <div className="mb-3 flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">{getMesAnoLabel(chave)}</h4>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {itens.length} {itens.length === 1 ? 'negócio' : 'negócios'}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {itens.map((neg) => (
                <NegocioCard key={neg.id} negocio={neg} estagio={mapaSlug.get(neg.estagio)} desqualificado={desqualificado} />
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
  desqualificado = false,
}: {
  negocio: NegocioComRelacoes
  estagio: EstagioPipeline | undefined
  desqualificado?: boolean
}) {
  const dataRef = getDataReferencia(negocio)
  const tipo = estagio?.tipo ?? 'aberto'
  const cores = corPorTipo(tipo)
  const nomeEstagio = estagio?.nome ?? negocio.estagio
  const clienteNome = negocio.clientes?.razao_social ?? ''

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <BotaoTimeline negocioId={negocio.id} titulo={negocio.titulo}>
            <span className="text-sm font-semibold text-foreground leading-snug truncate">{negocio.titulo}</span>
          </BotaoTimeline>
          {desqualificado ? (
            <Badge className="shrink-0 text-[10px] px-1.5 py-0 border bg-amber-500/10 text-amber-600">
              Desqualificado
            </Badge>
          ) : (
            <Badge className={cn('shrink-0 text-[10px] px-1.5 py-0 border', cores.badge)}>{nomeEstagio}</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {negocio.clientes?.razao_social && (
            <span>
              <span className="text-muted-foreground/50">Cliente:</span> {negocio.clientes.razao_social}
            </span>
          )}
          {negocio.solucoes?.nome && (
            <span>
              <span className="text-muted-foreground/50">Solução:</span> {negocio.solucoes.nome}
            </span>
          )}
          {negocio.profiles?.full_name && (
            <span>
              <span className="text-muted-foreground/50">Responsável:</span> {negocio.profiles.full_name}
            </span>
          )}
        </div>

        {negocio.motivo_perda && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="text-muted-foreground/50">
              {desqualificado ? 'Motivo da desqualificação:' : 'Motivo:'}
            </span>{' '}
            {negocio.motivo_perda}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1">
          <NegocioCardActions negocioId={negocio.id} negocioTitulo={negocio.titulo} desqualificado={desqualificado} />
          <BotaoLembrete negocioId={negocio.id} clienteNome={clienteNome} />
        </div>
      </div>

      <div className="flex shrink-0 flex-row gap-4 sm:flex-col sm:items-end sm:gap-1">
        <div className="text-sm font-semibold text-foreground tabular-nums">{formatBRL(negocio.valor_estimado)}</div>
        <div className="text-xs text-muted-foreground">{formatDataLocal(dataRef)}</div>
      </div>
    </div>
  )
}
