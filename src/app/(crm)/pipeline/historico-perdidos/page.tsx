import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NegocioComRelacoes } from '@/types'

function formatBRL(valor: number | null): string {
  if (valor === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatMesAno(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function formatDataPerda(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleDateString('pt-BR')
}

function getDataReferencia(negocio: NegocioComRelacoes): string {
  return negocio.estagio_atualizado_em ?? negocio.updated_at
}

function getMesAnoKey(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMesAnoLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  const label = formatMesAno(d)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default async function HistoricoPerdidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Calcular início do mês corrente — perdidos anteriores a essa data vão para o histórico
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const query = supabase
    .from('negocios')
    .select(`
      *,
      clientes ( razao_social ),
      solucoes ( nome ),
      profiles ( full_name )
    `)
    .eq('estagio', 'fechado_perdido')
    // Registros com estagio_atualizado_em preenchido e anterior ao mês corrente
    // OU sem estagio_atualizado_em mas com updated_at anterior ao mês corrente
    .or(
      `and(estagio_atualizado_em.not.is.null,estagio_atualizado_em.lt.${startOfMonth}),` +
      `and(estagio_atualizado_em.is.null,updated_at.lt.${startOfMonth})`
    )
    .order('estagio_atualizado_em', { ascending: false })

  // Comercial vê apenas os próprios negócios
  if (profile?.role === 'comercial') {
    query.eq('responsavel_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm text-destructive">
            Erro ao carregar histórico de perdidos. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    )
  }

  const negocios = (data ?? []) as NegocioComRelacoes[]

  if (negocios.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 py-16 text-center">
          <TrendingDown className="size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum negócio perdido em meses anteriores
          </p>
          <p className="text-xs text-muted-foreground/60">
            Os negócios marcados como perdidos no mês corrente aparecem no Pipeline principal
          </p>
        </div>
      </div>
    )
  }

  // Agrupar por mês/ano (chave YYYY-MM), ordenado do mais recente para o mais antigo
  const grupos = new Map<string, NegocioComRelacoes[]>()
  for (const neg of negocios) {
    const key = getMesAnoKey(getDataReferencia(neg))
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(neg)
  }

  // Ordenar chaves do mais recente para o mais antigo
  const chavesOrdenadas = Array.from(grupos.keys()).sort((a, b) => b.localeCompare(a))

  return (
    <div className="flex flex-col gap-6">
      <Header />

      <div className="flex flex-col gap-8">
        {chavesOrdenadas.map((chave) => {
          const itens = grupos.get(chave)!
          return (
            <section key={chave}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {getMesAnoLabel(chave)}
                </h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {itens.length} {itens.length === 1 ? 'negócio' : 'negócios'}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {itens.map((neg) => (
                  <NegocioCard key={neg.id} negocio={neg} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
          Histórico de Perdidos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Negócios encerrados em meses anteriores.
        </p>
      </div>
      <Link
        href="/pipeline"
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'shrink-0'
        )}
      >
        <ArrowLeft className="size-4" />
        Voltar ao Pipeline
      </Link>
    </div>
  )
}

function NegocioCard({ negocio }: { negocio: NegocioComRelacoes }) {
  const dataPerda = negocio.estagio_atualizado_em ?? negocio.updated_at

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      {/* Coluna principal */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground leading-snug truncate">
            {negocio.titulo}
          </span>
          <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">
            Perdido
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
      </div>

      {/* Coluna de valores */}
      <div className="flex shrink-0 flex-row gap-4 sm:flex-col sm:items-end sm:gap-1">
        <div className="text-sm font-semibold text-foreground tabular-nums">
          {formatBRL(negocio.valor_estimado)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDataPerda(dataPerda)}
        </div>
      </div>
    </div>
  )
}
