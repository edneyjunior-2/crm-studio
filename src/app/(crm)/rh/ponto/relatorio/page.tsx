import { getAuthUser } from '@/lib/auth'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Colaborador, Ponto } from '@/types/rh'

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

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

function somarMes(mes: string, delta: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 + delta, 1)
  const ma = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${ma}`
}

function calcDeducao(colaborador: Colaborador, faltas: number): number {
  if (!colaborador.salario || faltas === 0) return 0
  const valorDia =
    colaborador.tipo_remuneracao === 'diaria'
      ? colaborador.salario
      : colaborador.salario / 30
  return valorDia * faltas
}

interface PageProps {
  searchParams: Promise<{ mes?: string }>
}

export default async function RelatorioPontoPage({ searchParams }: PageProps) {
  const params = await searchParams
  const mesSelecionado = /^\d{4}-\d{2}$/.test(params.mes ?? '') ? (params.mes as string) : mesAtual()

  const mesAnterior = somarMes(mesSelecionado, -1)
  const mesSeguinte = somarMes(mesSelecionado, 1)
  const mesHoje = mesAtual()
  const isFuturo = mesSelecionado > mesHoje

  const [ano, mes] = mesSelecionado.split('-').map(Number)
  const inicioMes = `${mesSelecionado}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fimMes = `${mesSelecionado}-${String(ultimoDia).padStart(2, '0')}`

  const { supabase } = await getAuthUser()

  const [{ data: colaboradoresRaw }, { data: pontosRaw }] = await Promise.all([
    supabase
      .from('colaboradores')
      .select('*')
      .eq('status', 'ativo')
      .order('nome', { ascending: true }),
    supabase
      .from('pontos')
      .select('*')
      .gte('data', inicioMes)
      .lte('data', fimMes),
  ])

  const colaboradores = (colaboradoresRaw ?? []) as Colaborador[]
  const pontos = (pontosRaw ?? []) as Ponto[]

  type Linha = {
    colaborador: Colaborador
    presencas: number
    faltas: number
    justificadas: number
    deducao: number
  }

  const linhas: Linha[] = colaboradores.map((col) => {
    const pontosCol = pontos.filter((p) => p.colaborador_id === col.id)
    const presencas = pontosCol.filter((p) => p.presente).length
    const faltas = pontosCol.filter((p) => !p.presente).length
    const justificadas = pontosCol.filter((p) => !p.presente && p.justificativa).length
    const deducao = calcDeducao(col, faltas)
    return { colaborador: col, presencas, faltas, justificadas, deducao }
  })

  const totalDeducoes = linhas.reduce((acc, l) => acc + l.deducao, 0)
  const totalFaltas = linhas.reduce((acc, l) => acc + l.faltas, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/rh/ponto"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
              Relatório de Ponto
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Resumo mensal de presenças, faltas e deduções
            </p>
          </div>
        </div>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <Link
          href={`/rh/ponto/relatorio?mes=${mesAnterior}`}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
          Mês anterior
        </Link>
        <div className="flex flex-col items-center gap-1">
          <span className="text-base font-semibold text-foreground">
            {nomeMes(mesSelecionado)}
          </span>
          {mesSelecionado === mesHoje && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Mês atual
            </span>
          )}
        </div>
        <Link
          href={`/rh/ponto/relatorio?mes=${mesSeguinte}`}
          aria-disabled={isFuturo}
          className={`flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors ${
            isFuturo ? 'cursor-not-allowed opacity-40' : 'text-foreground hover:bg-muted'
          }`}
        >
          Próximo mês
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* KPIs do mês */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-xs text-muted-foreground">Colaboradores ativos</span>
          <span className="text-2xl font-bold text-foreground">{colaboradores.length}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 px-4 py-3">
          <span className="text-xs text-red-700 dark:text-red-400">Total de faltas</span>
          <span className="text-2xl font-bold text-red-700 dark:text-red-400">{totalFaltas}</span>
        </div>
        <div className="col-span-2 flex flex-col gap-1 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 px-4 py-3 sm:col-span-1">
          <span className="text-xs text-red-700 dark:text-red-400">Total a descontar</span>
          <span className="text-2xl font-bold text-red-700 dark:text-red-400">
            {brl(totalDeducoes)}
          </span>
        </div>
      </div>

      {/* Tabela */}
      {colaboradores.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhum colaborador ativo.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-semibold text-foreground">Colaborador</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Presenças</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Faltas</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Justificadas</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Remuneração</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">Desconto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map(({ colaborador: c, presencas, faltas, justificadas, deducao }) => (
                <tr key={c.id} className="bg-card transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{c.nome}</p>
                    {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium text-green-700 dark:text-green-400">
                      {presencas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={faltas > 0 ? 'font-semibold text-red-600' : 'text-muted-foreground'}>
                      {faltas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {justificadas}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {c.salario
                      ? `${brl(c.salario)}${c.tipo_remuneracao === 'diaria' ? '/dia' : '/mês'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deducao > 0 ? (
                      <span className="font-semibold text-red-600">−{brl(deducao)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {totalDeducoes > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40">
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                    Total a descontar
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    −{brl(totalDeducoes)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        * Desconto por falta = {' '}
        <strong>valor da diária</strong> (para remuneração por diária) ou{' '}
        <strong>salário ÷ 30</strong> (para remuneração mensal), conforme padrão CLT art. 472.
      </p>
    </div>
  )
}
