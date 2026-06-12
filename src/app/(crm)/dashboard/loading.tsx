export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {/* Cabecalho */}
      <div className="flex flex-col gap-3">
        <div>
          <div className="h-3 w-40 rounded bg-muted" />
          <div className="mt-2 h-7 w-52 rounded bg-muted" />
        </div>
      </div>

      {/* Cards de metricas — 4 colunas simuladas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="size-8 rounded-lg bg-muted" />
            </div>
            <div>
              <div className="h-8 w-32 rounded bg-muted" />
              <div className="mt-2 h-3 w-28 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Widget reunioes placeholder */}
      <div className="h-16 rounded-xl border border-border bg-card" />

      {/* Secao pipeline */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-16 rounded bg-muted" />
          <div className="h-3 w-12 rounded bg-muted" />
        </div>
        {/* Grafico pipeline */}
        <div className="h-40 rounded-xl border border-border bg-card" />
        {/* Funil */}
        <div className="h-28 rounded-xl border border-border bg-card" />
        {/* Followups */}
        <div className="h-32 rounded-xl border border-border bg-card" />
      </div>
    </div>
  )
}
