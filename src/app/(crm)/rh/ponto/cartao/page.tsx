import { getAuthUser } from '@/lib/auth'
import { getFeriados, getFeriadoNoDia } from '@/lib/feriados'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FiltrosCartao } from './filtros-cartao'
import { DiasPonto, type DiaPontoView, type SituacaoDia } from './dias-ponto'
import { formatarMinutos } from './ponto-utils'
import type { Colaborador, JornadaSemanal, Ponto } from '@/types/rh'

const CHAVES_JORNADA: readonly (keyof JornadaSemanal)[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/** Minutos esperados de trabalho no dia da semana informado (0=domingo..6=sábado). Null = jornada não cadastrada. */
function minutosEsperados(jornada: JornadaSemanal | null, diaSemana: number): number | null {
  if (!jornada) return null
  return jornada[CHAVES_JORNADA[diaSemana]] ?? 0
}

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
  let jornadaSemanal: JornadaSemanal | null = null
  if (colaboradorId) {
    const [{ data: pontosRaw }, { data: colaboradorCompleto }] = await Promise.all([
      supabase
        .from('pontos')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .gte('data', inicioMes)
        .lte('data', fimMes),
      supabase
        .from('colaboradores')
        .select('jornada_semanal')
        .eq('id', colaboradorId)
        .maybeSingle(),
    ])
    pontos = (pontosRaw ?? []) as Ponto[]
    jornadaSemanal = (colaboradorCompleto?.jornada_semanal as JornadaSemanal | null) ?? null
  }

  const pontoMap = new Map(pontos.map((p) => [p.data, p]))
  const feriados = getFeriados(ano)

  const dias: DiaPontoView[] = []
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataISO = `${mesSelecionado}-${String(dia).padStart(2, '0')}`
    const dataObj = new Date(ano, mesNum - 1, dia)
    const ponto = pontoMap.get(dataISO)
    const feriado = getFeriadoNoDia(feriados, dataISO)
    const diaSemana = dataObj.getDay() // 0 = domingo, 6 = sábado

    let situacao: SituacaoDia
    if (ponto) {
      situacao = ponto.tipo_dia === 'normal' ? 'normal' : (ponto.tipo_dia as SituacaoDia)
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

    const justificado = !!ponto?.tipo_justificativa
    const esperado = minutosEsperados(jornadaSemanal, diaSemana)

    // Delta de banco de horas: só faz sentido em dias que deveriam gerar
    // comparação (normal/falta/folga_banco_horas); feriado/folga são sempre 0;
    // atestado e dias justificados pelo RH também não geram débito;
    // sem_registro fica sem informação suficiente (null, não entra na soma).
    let delta: number | null = null
    if (situacao === 'feriado' || situacao === 'folga' || situacao === 'atestado' || justificado) {
      delta = 0
    } else if (situacao === 'sem_registro') {
      delta = null
    } else if (esperado !== null) {
      delta = minutosTrabalhados - esperado
    }

    dias.push({
      data: dataISO,
      dataExibicao: `${String(dataObj.getDate()).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}`,
      diaSemanaLabel: feriado?.nome ?? nomeDiaSemana(dataObj),
      situacao,
      entrada_1: ponto?.entrada_1 ?? null,
      saida_1: ponto?.saida_1 ?? null,
      entrada_2: ponto?.entrada_2 ?? null,
      saida_2: ponto?.saida_2 ?? null,
      minutosTrabalhados,
      minutosEsperados: esperado,
      delta,
      batidaManual: ponto?.batida_manual ?? false,
      justificativa: ponto?.justificativa ?? null,
      tipoJustificativa: ponto?.tipo_justificativa ?? null,
      temDocumento: !!ponto?.documento_path,
      temPonto: !!ponto,
    })
  }

  const diasTrabalhados = dias.filter((d) => d.situacao === 'normal').length
  const faltas = dias.filter((d) => d.situacao === 'falta').length
  const atestados = dias.filter((d) => d.situacao === 'atestado').length
  const totalMinutos = dias.reduce((acc, d) => acc + d.minutosTrabalhados, 0)

  const jornadaConfigurada = jornadaSemanal !== null
  const saldoBancoHoras = dias.reduce((acc, d) => acc + (d.delta ?? 0), 0)

  const colaboradorSelecionado = colaboradores.find((c) => c.id === colaboradorId)
  const primeiroNome = colaboradorSelecionado?.nome.split(' ')[0] ?? 'O colaborador'

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

          {/* Banco de horas do mês */}
          {jornadaConfigurada ? (
            <div
              className={`flex flex-col gap-1 rounded-xl border px-4 py-3 ${
                saldoBancoHoras === 0
                  ? 'border-border bg-card'
                  : saldoBancoHoras > 0
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
              }`}
            >
              <span className="text-xs text-muted-foreground">Banco de horas do mês</span>
              <span className="text-base font-bold text-foreground">
                {saldoBancoHoras === 0
                  ? 'Sem pendência — bateu certinho'
                  : saldoBancoHoras > 0
                    ? `A empresa deve ${formatarMinutos(saldoBancoHoras)} a ${primeiroNome}`
                    : `${primeiroNome} deve ${formatarMinutos(Math.abs(saldoBancoHoras))} à empresa`}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Jornada não cadastrada para {primeiroNome} — banco de horas não é calculado.
              </span>
            </div>
          )}

          <DiasPonto key={colaboradorId} colaboradorId={colaboradorId} dias={dias} />

          {/* Legenda */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><strong className="text-green-700 dark:text-green-400">Trabalhou</strong> — bateu o ponto normalmente</span>
            <span><strong className="text-red-700 dark:text-red-400">Faltou</strong> — não veio e não tem justificativa</span>
            <span><strong className="text-blue-700 dark:text-blue-400">Atestado médico</strong> — falta justificada por atestado</span>
            <span><strong className="text-purple-700 dark:text-purple-400">Folga (banco de horas)</strong> — folga combinada, compensando horas trabalhadas antes</span>
            <span><strong>Folga/Feriado</strong> — fim de semana ou feriado, não é falta</span>
            <span><strong>Justificado</strong> — dia com pendência, mas o RH explicou o motivo; não entra no banco de horas</span>
          </div>
        </>
      )}
    </div>
  )
}
