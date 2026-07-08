import Link from 'next/link'
import { CheckCircle, Building2, User, Scale } from 'lucide-react'
import { labelStatusProcesso } from '@/lib/processos-status'

interface ProcessoArquivado {
  id:           string
  numeroProcesso: string
  status:       string
  clienteNome:  string | null
  advogadoNome: string | null
  area:         string | null
  areaLabel:    string | null
  assunto:      string | null
  tribunalSlug: string | null
}

interface Props {
  processos: ProcessoArquivado[]
}

export function ProcessosArquivados({ processos }: Props) {
  if (processos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
        <CheckCircle className="size-10 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium text-foreground">Nenhum processo concluído</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Processos concluídos aparecem aqui.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {processos.map((p) => (
        <Link
          key={p.id}
          href={`/processos/${p.id}`}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card/80"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
            <CheckCircle className="size-4 text-emerald-600" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="font-mono text-sm font-semibold text-foreground group-hover:text-primary">
                {p.numeroProcesso}
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                {labelStatusProcesso(p.status)}
              </span>
              {p.tribunalSlug && (
                <span className="text-xs text-muted-foreground">
                  {p.tribunalSlug.toUpperCase()}
                </span>
              )}
            </div>

            {p.assunto && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.assunto}</p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {p.clienteNome && (
                <span className="flex items-center gap-1">
                  <Building2 className="size-3 shrink-0" />
                  {p.clienteNome}
                </span>
              )}
              {p.advogadoNome && (
                <span className="flex items-center gap-1">
                  <User className="size-3 shrink-0" />
                  {p.advogadoNome}
                </span>
              )}
              {p.areaLabel && (
                <span className="flex items-center gap-1">
                  <Scale className="size-3 shrink-0" />
                  {p.areaLabel}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
