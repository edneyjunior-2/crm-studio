import { Sparkles } from 'lucide-react'
import { changelogVisivel, ultimaAtualizacaoVisivel } from '@/lib/changelog'
import type { Release } from '@/lib/changelog'
import { MarcarVisto } from './marcar-visto'
import { getAuthUser } from '@/lib/auth'
import { modulosEfetivos } from '@/lib/modulos'

/** Converte 'YYYY-MM-DD' para '30 de junho de 2026' sem usar toISOString. */
function formatarData(ymd: string): string {
  const [ano, mes, dia] = ymd.split('-').map(Number)
  // mês é 0-indexed no construtor de Date quando passamos os três args
  const d = new Date(ano, mes - 1, dia)
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const tipoBadge: Record<NonNullable<Release['tipo']>, { label: string; className: string }> = {
  novidade: {
    label: 'Novidade',
    className: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20',
  },
  melhoria: {
    label: 'Melhoria',
    className: 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20',
  },
  correcao: {
    label: 'Correção',
    className: 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20',
  },
}

export default async function AtualizacoesPage() {
  const { plano, empresaId, supabase } = await getAuthUser()

  let modulosAtivosExtras: string[] = []
  if (empresaId) {
    const { data: empresaData } = await supabase
      .from('empresas')
      .select('modulos_ativos')
      .eq('id', empresaId)
      .single()
    modulosAtivosExtras = empresaData?.modulos_ativos ?? []
  }
  const modulos = modulosEfetivos(plano, modulosAtivosExtras)
  const changelogFiltrado = changelogVisivel(modulos)

  return (
    <div className="flex flex-col gap-6 p-6">
      <MarcarVisto ultimaVisivel={changelogFiltrado[0]?.id ?? ''} />

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-accent">
          <Sparkles className="size-5 text-sidebar-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Atualizações</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe as melhorias do CRM
          </p>
        </div>
      </div>

      {/* Lista de lançamentos */}
      <div className="flex flex-col gap-4">
        {changelogFiltrado.map((release) => {
          const badge = release.tipo ? tipoBadge[release.tipo] : null
          return (
            <div
              key={release.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {badge && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatarData(release.data)}
                </span>
              </div>

              <h2 className="mb-2 text-base font-semibold text-foreground">
                {release.titulo}
              </h2>

              <ul className="flex flex-col gap-1.5">
                {release.itens.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
