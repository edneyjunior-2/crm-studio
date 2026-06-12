'use client'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface MesFluxo {
  mes: string
  entradas: number
  saidas: number
}

interface FluxoCaixaChartProps {
  dados: MesFluxo[]
}

export function FluxoCaixaChart({ dados }: FluxoCaixaChartProps) {
  const maxVal = Math.max(
    ...dados.map((d) => Math.max(d.entradas, d.saidas)),
    1
  )

  if (dados.every((d) => d.entradas === 0 && d.saidas === 0)) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Sem movimentações registradas nos últimos 6 meses.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2 h-48">
        {dados.map((d, i) => {
          const entH = Math.round((d.entradas / maxVal) * 100)
          const saiH = Math.round((d.saidas / maxVal) * 100)

          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end gap-0.5 h-40">
                <div className="group relative flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-sm bg-emerald-500/80 transition-all"
                    style={{ height: `${entH}%` }}
                  />
                  {d.entradas > 0 && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] text-background shadow z-10">
                      {BRL(d.entradas)}
                    </div>
                  )}
                </div>
                <div className="group relative flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-sm bg-red-500/70 transition-all"
                    style={{ height: `${saiH}%` }}
                  />
                  {d.saidas > 0 && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] text-background shadow z-10">
                      {BRL(d.saidas)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground capitalize">{d.mes}</span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500/80" />
          <span className="text-xs text-muted-foreground">Entradas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-red-500/70" />
          <span className="text-xs text-muted-foreground">Saídas</span>
        </div>
      </div>
    </div>
  )
}
