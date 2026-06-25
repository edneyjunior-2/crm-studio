import { getAuthUser } from '@/lib/auth'
import { PontoGrid } from './ponto-grid'
import { ObraFilter } from './obra-filter'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, BarChart3, ArrowLeft } from 'lucide-react'
import type { Colaborador, Ponto } from '@/types/rh'

function dataISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function dataExibicao(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return iso
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${dia}/${mes}/${ano} — ${nomes[parseInt(mes, 10) - 1] ?? mes}`
}

function somarDias(iso: string, delta: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  d.setDate(d.getDate() + delta)
  return dataISO(d)
}

interface PageProps {
  searchParams: Promise<{ data?: string; obra?: string }>
}

export default async function PontoPage({ searchParams }: PageProps) {
  const params = await searchParams
  const hoje = dataISO(new Date())
  const dataSelecionada = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '')
    ? (params.data as string)
    : hoje

  const obraId = params.obra ?? null
  const isFuturo = dataSelecionada > hoje

  const { supabase } = await getAuthUser()

  // Obras ativas para o filtro
  const { data: obrasRaw } = await supabase
    .from('obras')
    .select('id, nome')
    .in('status', ['em_andamento', 'orcamento', 'pausada'])
    .order('nome', { ascending: true })

  const obras = (obrasRaw ?? []) as { id: string; nome: string }[]

  // Se filtrado por obra, buscar quais colaboradores estão nela
  let colaboradoresIds: string[] | null = null
  if (obraId) {
    const { data: equipe } = await supabase
      .from('obras_colaboradores')
      .select('colaborador_id')
      .eq('obra_id', obraId)
      .eq('ativo', true)

    colaboradoresIds = (equipe ?? []).map((e) => e.colaborador_id as string)
  }

  // Colaboradores ativos (filtrados por obra se aplicável)
  let colaboradoresQuery = supabase
    .from('colaboradores')
    .select('*')
    .eq('status', 'ativo')
    .order('nome', { ascending: true })

  if (colaboradoresIds !== null) {
    if (colaboradoresIds.length === 0) {
      // Obra sem colaboradores designados
      colaboradoresQuery = colaboradoresQuery.in('id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      colaboradoresQuery = colaboradoresQuery.in('id', colaboradoresIds)
    }
  }

  const [{ data: colaboradoresRaw }, { data: pontosRaw }] = await Promise.all([
    colaboradoresQuery,
    supabase
      .from('pontos')
      .select('*')
      .eq('data', dataSelecionada),
  ])

  const colaboradores = (colaboradoresRaw ?? []) as Colaborador[]
  const pontos = (pontosRaw ?? []) as Ponto[]

  const pontoMap = new Map(pontos.map((p) => [p.colaborador_id, p]))
  const colaboradoresComPonto = colaboradores.map((c) => ({
    ...c,
    ponto: pontoMap.get(c.id),
  }))

  const diaAnterior = somarDias(dataSelecionada, -1)
  const diaSeguinte = somarDias(dataSelecionada, 1)

  // Preserva obraId nos links de navegação de data
  const obraParam = obraId ? `&obra=${obraId}` : ''

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/rh"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
              Ponto Diário
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Registro de presença e ausência dos colaboradores
            </p>
          </div>
        </div>
        <Link
          href={`/rh/ponto/relatorio`}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <BarChart3 className="size-4" />
          Relatório mensal
        </Link>
      </div>

      {/* Filtro de obra */}
      <ObraFilter obras={obras} obraAtual={obraId} data={dataSelecionada} />

      {/* Navegação de data */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <Link
          href={`/rh/ponto?data=${diaAnterior}${obraParam}`}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
          Dia anterior
        </Link>

        <div className="flex flex-col items-center gap-1">
          <span className="text-base font-semibold text-foreground">
            {dataExibicao(dataSelecionada)}
          </span>
          {dataSelecionada === hoje && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Hoje
            </span>
          )}
        </div>

        <Link
          href={`/rh/ponto?data=${diaSeguinte}${obraParam}`}
          aria-disabled={isFuturo}
          className={`flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors ${
            isFuturo
              ? 'cursor-not-allowed opacity-40'
              : 'text-foreground hover:bg-muted'
          }`}
        >
          Próximo dia
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* Grid de ponto */}
      <PontoGrid data={dataSelecionada} colaboradores={colaboradoresComPonto} />
    </div>
  )
}
