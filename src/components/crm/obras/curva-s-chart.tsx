'use client'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export interface PontoMedicao {
  numero_medicao: number
  /** Valor acumulado até esta medição */
  valorAcumulado: number
}

interface CurvaSChartProps {
  pontos: PontoMedicao[]
  valorTotalOrcamento?: number
}

export function CurvaSChart({ pontos, valorTotalOrcamento }: CurvaSChartProps) {
  if (pontos.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Sem medições para exibir a curva S.
        </p>
      </div>
    )
  }

  const maxVal = Math.max(
    ...pontos.map((p) => p.valorAcumulado),
    valorTotalOrcamento ?? 0,
    1,
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Gráfico de barras simples como curva S (valor acumulado por nº de medição) */}
      <div className="flex items-end gap-2 h-40">
        {pontos.map((p, i) => {
          const pct = Math.round((p.valorAcumulado / maxVal) * 100)
          // Linha meta (orçamento total)
          const metaPct = valorTotalOrcamento
            ? Math.round((valorTotalOrcamento / maxVal) * 100)
            : null

          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1 relative">
              {/* Barra de meta (fundo) */}
              {metaPct != null && (
                <div
                  className="absolute bottom-0 w-full rounded-t-sm bg-border/60"
                  style={{ height: `${metaPct}%` }}
                />
              )}
              {/* Barra realizado */}
              <div className="group relative w-full h-full flex items-end">
                <div
                  className="w-full rounded-t-sm bg-blue-500/70 transition-all relative z-10"
                  style={{ height: `${pct}%` }}
                />
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] text-background shadow z-20">
                  <span>Medição #{p.numero_medicao}</span>
                  <span>{BRL(p.valorAcumulado)}</span>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">#{p.numero_medicao}</span>
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 border-t border-border pt-2">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-blue-500/70" />
          <span className="text-xs text-muted-foreground">Valor acumulado medido</span>
        </div>
        {valorTotalOrcamento != null && (
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-border/60 border border-border" />
            <span className="text-xs text-muted-foreground">
              Meta: {BRL(valorTotalOrcamento)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
