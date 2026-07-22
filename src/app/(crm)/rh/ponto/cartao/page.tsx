import { getAuthUser } from '@/lib/auth'
import { getFeriados, getFeriadoNoDia } from '@/lib/feriados'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FiltrosCartao } from './filtros-cartao'
import type { Colaborador, Ponto } from '@/types/rh'

function mesAtual(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}`
}

function nomeMes(mes: string): string {
  const [ano, m] = mes.split('-')
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${nomes[parseInt(m, 10) - 1] ?? m} ${ano}`
}

function nomeDiaSemana(data: Date): string {
  const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  return nomes[data.getDay()] ?? ''
}

/** Minutos entre dois horários HH:MM. Retorna 0 se algum estiver ausente ou a saída for antes da entrada. */
function minutosEntre(entrada: string | null, saida: string | null): number {
  if (!entrada || !saida) return 0
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = saida.split(':').map(Number)
  if ([eh, em, sh, sm].some((n) => Number.isNaN(n))) return 0
  const minutos = (sh * 60 + sm) - (eh * 60 + em)
  return minutos > 0 ? minutos : 0
}

function formatarMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

type SituacaoDia = 'normal' | 'falta' | 'atestado' | 'folga_banco_horas' | 'folga' | 'feriado' | 'sem_registro'

const SITUACAO_CONFIG: Record<SituacaoDia, { label: string; badge: string }> = {
  normal:             { label: 'Trabalhou',              badge: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400' },
  falta:              { label: 'Faltou',                 badge: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400' },
  atestado:           { label: 'Atestado médico',        badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400' },
  folga_banco_horas:  { label: 'Folga (banco de horas)', badge: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-400' },
  folga:              { label: 'Folga',                  badge: 'border-border bg-muted/40 text-muted-foreground' },
  feriado:            { label: 'Feriado',                badge: 'border-border bg-muted/40 text-muted-foreground' },
  sem_registro:       { label: 'Sem registro',            badge: 'border-dashed border-border text-muted-foreground/70' },
}

interface DiaCartao {
  data: string
  dataObj: Date
  situacao: SituacaoDia
  feriadoNome?: string
  entrada_1: string | null
  saida_1: string | null
  entrada_2: string | null
  saida_2: string | null
  minutosTrabalhados: number
  batidaManual: boolean
}

interface PageProps {
  searchParams: Promise<{ colaborador?: string; mes?: string }>
}

export default async function CartaoPontoPage({ searchParams }: PageProps) {
  const params = await searchParams
  const mesSelecionado = /^\d{4}-\d{2}$/.test(params.mes ?? '') ? (params.mes as string) : mesAtual()

  const { supabase } = await getAuthUser()

  const { data: colaboradoresRaw } = await supabase
    .from('colaboradores')
    .select('id, nome, cargo')
    .order('nome', { ascending: true })

  const colaboradores = (colaboradoresRaw ?? []) as Pick<Colaborador, 'id' | 'nome' | 'cargo'>[]

  const colaboradorId = colaboradores.some((c) => c.id === params.colaborador)
    ? (params.colaborador as string)
    : (colaboradores[0]?.id ?? '')

  const [ano, mesNum] = mesSelecionado.split('-').map(Number)
  const inicioMes = `${mesSelecionado}-01`
  const ultimoDia = new Date(ano, mesNum, 0).getDate()
  const fimMes = `${mesSelecionado}-${String(ultimoDia).padStart(2, '0')}`

  let pontos: Ponto[] = []
  if (colaboradorId) {
    const { data: pontosRaw } = await supabase
      .from('pontos')
      .select('*')
      .eq('colaborador_id', colaboradorId)
      .gte('data', inicioMes)
      .lte('data', fimMes)
    pontos = (pontosRaw ?? []) as Ponto[]
  }

  const pontoMap = new Map(pontos.map((p) => [p.data, p]))
  const feriados = getFeriados(ano)

  const dias: DiaCartao[] = []
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataISO = `${mesSelecionado}-${String(dia).padStart(2, '0')}`
    const dataObj = new Date(ano, mesNum - 1, dia)
    const ponto = pontoMap.get(dataISO)
    const feriado = getFeriadoNoDia(feriados, dataISO)
    const diaSemana = dataObj.getDay() // 0 = domingo, 6 = sábado

    let situacao: SituacaoDia
    if (ponto) {
      situacao = ponto.tipo_dia === 'normal'
        ? 'normal'
        : (ponto.tipo_dia as SituacaoDia)
    } else if (feriado) {
      situacao = 'feriado'
    } else if (diaSemana === 0 || diaSemana === 6) {
      situacao = 'folga'
    } else {
      situacao = 'sem_registro'
    }

    const minutosTrabalhados =
      minutosEntre(ponto?.entrada_1 ?? null, ponto?.saida_1 ?? null) +
      minutosEntre(ponto?.entrada_2 ?? null, ponto?.saida_2 ?? null)

    dias.push({
      data: dataISO,
      dataObj,
      situacao,
      feriadoNome: feriado?.nome,
      entrada_1: ponto?.entrada_1 ?? null,
      saida_1: ponto?.saida_1 ?? null,
      entrada_2: ponto?.entrada_2 ?? null,
      saida_2: ponto?.saida_2 ?? null,
      minutosTrabalhados,
      batidaManual: ponto?.batida_manual ?? false,
    })
  }

  const diasTrabalhados = dias.filter((d) => d.situacao === 'normal').length
  const faltas = dias.filter((d) => d.situacao === 'falta').length
  const atestados = dias.filter((d) => d.situacao === 'atestado').length
  const totalMinutos = dias.reduce((acc, d) => acc + d.minutosTrabalhados, 0)

  const colaboradorSelecionado = colaboradores.find((c) => c.id === colaboradorId)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/rh/ponto"
          className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
            Cartão de Ponto
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            O horário batido de cada colaborador, mês a mês, em linguagem simples
          </p>
        </div>
      </div>

      {colaboradores.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhum colaborador cadastrado.</p>
        </div>
      ) : (
        <>
          <FiltrosCartao
            colaboradores={colaboradores}
            colaboradorAtual={colaboradorId}
            mes={mesSelecionado}
          />

          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-foreground">
              {colaboradorSelecionado?.nome} — {nomeMes(mesSelecionado)}
            </span>
            {colaboradorSelecionado?.cargo && (
              <span className="text-xs text-muted-foreground">{colaboradorSelecionado.cargo}</span>
            )}
          </div>

          {/* Resumo do mês */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-xl border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20 px-4 py-3">
              <span className="text-xs text-green-700 dark:text-green-400">Dias trabalhados</span>
              <span className="text-2xl font-bold text-green-700 dark:text-green-400">{diasTrabalhados}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 px-4 py-3">
              <span className="text-xs text-red-700 dark:text-red-400">Faltas</span>
              <span className="text-2xl font-bold text-red-700 dark:text-red-400">{faltas}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 px-4 py-3">
              <span className="text-xs text-blue-700 dark:text-blue-400">Atestados</span>
              <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{atestados}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-xs text-muted-foreground">Horas trabalhadas</span>
              <span className="text-2xl font-bold text-foreground">{formatarMinutos(totalMinutos)}</span>
            </div>
          </div>

          {/* Lista dia a dia */}
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
            {dias.map((d) => {
              const config = SITUACAO_CONFIG[d.situacao]
              const temHorario = d.entrada_1 || d.saida_1 || d.entrada_2 || d.saida_2
              return (
                <div key={d.data} className="flex flex-wrap items-center justify-between gap-2 bg-card px-4 py-2.5">
                  <div className="flex min-w-[9rem] flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {String(d.dataObj.getDate()).padStart(2, '0')}/{String(mesNum).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.feriadoNome ?? nomeDiaSemana(d.dataObj)}
                    </span>
                  </div>

                  <div className="flex flex-1 items-center justify-end gap-3">
                    {temHorario && (
                      <span className="text-xs text-muted-foreground">
                        {d.entrada_1 ?? '—'}–{d.saida_1 ?? '—'}
                        {(d.entrada_2 || d.saida_2) && ` / ${d.entrada_2 ?? '—'}–${d.saida_2 ?? '—'}`}
                        {d.batidaManual && ' (lançado manualmente)'}
                      </span>
                    )}
                    {d.minutosTrabalhados > 0 && (
                      <span className="text-xs font-medium text-foreground">
                        {formatarMinutos(d.minutosTrabalhados)}
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.badge}`}
                    >
                      {config.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><strong className="text-green-700 dark:text-green-400">Trabalhou</strong> — bateu o ponto normalmente</span>
            <span><strong className="text-red-700 dark:text-red-400">Faltou</strong> — não veio e não tem justificativa</span>
            <span><strong className="text-blue-700 dark:text-blue-400">Atestado médico</strong> — falta justificada por atestado</span>
            <span><strong className="text-purple-700 dark:text-purple-400">Folga (banco de horas)</strong> — folga combinada, compensando horas trabalhadas antes</span>
            <span><strong>Folga/Feriado</strong> — fim de semana ou feriado, não é falta</span>
          </div>
        </>
      )}
    </div>
  )
}
