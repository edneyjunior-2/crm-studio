'use client'

// Grid de mês especializado em prazo — algoritmo de cálculo de células
// extraído e simplificado de mes-view.tsx (linhas ~436-460: acha o domingo
// anterior ao dia 1, gera 42 células, corta a 6ª linha/semana se cair
// inteira no mês seguinte). NÃO importa MesView (acoplado ao shape
// CalendarEvent do Google) nem reimplementa feriados/aniversários/bloqueios
// — é só prazo, conforme pedido do usuário.
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PrazoGrid {
  id: string
  processoId: string
  numeroProcesso: string
  descricao: string
  cumprido: boolean
  dataPrazo: string // 'YYYY-MM-DD'
}

interface Props {
  prazos: PrazoGrid[]
  onSelecionarPrazo: (prazo: PrazoGrid) => void
}

const DIAS_HEADER = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// getFullYear/getMonth/getDate — nunca toISOString() para data local (CLAUDE.md).
function hojeStr(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

export function PrazosMesGrid({ prazos, onSelecionarPrazo }: Props) {
  const [mesAtual, setMesAtual] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })

  const ano = mesAtual.getFullYear()
  const mes = mesAtual.getMonth()
  const hoje = hojeStr()

  // Agrupar prazos por data_prazo — comparação direta de componentes
  // 'YYYY-MM-DD' (string), sem `new Date(dataPrazo)`, pra evitar
  // deslocamento de fuso (mesma convenção de formatarData() em prazos-view.tsx).
  const prazosPorDia = new Map<string, PrazoGrid[]>()
  for (const p of prazos) {
    const key = p.dataPrazo.slice(0, 10)
    const lista = prazosPorDia.get(key)
    if (lista) lista.push(p)
    else prazosPorDia.set(key, [p])
  }

  // Gerar grid do mês: começa no domingo da semana do dia 1 (mesmo algoritmo
  // de mes-view.tsx).
  const primeiroDia = new Date(ano, mes, 1)
  const inicioDaGrade = new Date(primeiroDia)
  inicioDaGrade.setDate(1 - primeiroDia.getDay())

  const dias: string[] = []
  const cursor = new Date(inicioDaGrade)
  while (dias.length < 42) {
    dias.push(`${cursor.getFullYear()}-${(cursor.getMonth() + 1).toString().padStart(2, '0')}-${cursor.getDate().toString().padStart(2, '0')}`)
    cursor.setDate(cursor.getDate() + 1)
  }

  // Cortar última linha se já pertence toda ao próximo mês.
  const cortar6aLinha = (() => {
    if (!dias[35]) return false
    const d35 = new Date(dias[35])
    const mesD35 = d35.getMonth()
    const anoD35 = d35.getFullYear()
    return anoD35 > ano || (anoD35 === ano && mesD35 > mes)
  })()
  const grid = dias.slice(0, cortar6aLinha ? 35 : 42)

  const tituloMes = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function mesAnterior() {
    setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }

  function proximoMes() {
    setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize text-foreground">{tituloMes}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={mesAnterior}
            title="Mês anterior"
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={proximoMes}
            title="Próximo mês"
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {/* Header dias da semana */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {DIAS_HEADER.map((dia) => (
            <div key={dia} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {dia}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {grid.map((dateStr) => {
            const [y, m] = dateStr.split('-').map(Number)
            const diaNum = parseInt(dateStr.split('-')[2], 10)
            const mesDaCelulaAtual = m - 1 === mes && y === ano
            const isHoje = dateStr === hoje
            const prazosNoDia = prazosPorDia.get(dateStr) ?? []
            const visiveis = prazosNoDia.slice(0, 3)
            const extras = prazosNoDia.length - visiveis.length

            return (
              <div
                key={dateStr}
                className={cn('min-h-[96px] p-1.5', !mesDaCelulaAtual && 'bg-muted/20')}
              >
                <div className="mb-1.5">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                      isHoje
                        ? 'bg-primary text-primary-foreground'
                        : mesDaCelulaAtual
                          ? 'text-foreground'
                          : 'text-muted-foreground/40',
                    )}
                  >
                    {diaNum}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  {visiveis.map((p) => {
                    const vencido = !p.cumprido && p.dataPrazo.slice(0, 10) < hoje
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelecionarPrazo(p)}
                        title={`${p.descricao} (${p.numeroProcesso})`}
                        className={cn(
                          'w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-colors',
                          p.cumprido
                            ? 'bg-muted text-muted-foreground line-through'
                            : vencido
                              ? 'bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-400'
                              : 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400',
                        )}
                      >
                        {p.descricao}
                      </button>
                    )
                  })}
                  {extras > 0 && (
                    <span className="px-1 text-[10px] text-muted-foreground">+{extras} mais</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
