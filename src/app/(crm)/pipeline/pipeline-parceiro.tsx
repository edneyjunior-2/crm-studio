import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { listarEstagios, corPorTipo } from '@/lib/pipeline-estagios'
import type { Negocio } from '@/types'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// Data local sem toISOString (evita virar o dia por UTC).
function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('pt-BR')
}

type NegocioParceiro = Pick<
  Negocio,
  'id' | 'titulo' | 'estagio' | 'valor_estimado' | 'data_previsao_fechamento' | 'data_fechamento'
>

/**
 * Pipeline do parceiro externo — SÓ leitura.
 *
 * Tela própria em vez de reusar o KanbanBoard de propósito: o board carrega
 * formulário de negócio, drag-and-drop e ações de estágio, tudo negado pra ele
 * pela RLS. Uma variante read-only aqui é menor e mais segura do que espalhar
 * `readOnly` pelo board, pelo card e pelo form (que servem os papéis internos).
 *
 * A query é enxuta de propósito: NÃO embute clientes/solucoes/parceiros/profiles.
 * Essas tabelas são negadas ao role 'parceiro' (20260707150000) — embutir só
 * traria null e exporia a carteira do escritório se alguma policy afrouxasse.
 * Quem limita as linhas é a RLS de negocios, não este filtro.
 */
export async function PipelineParceiro() {
  const supabase = await createClient()
  const [estagios, negocios] = await Promise.all([
    listarEstagios(),
    fetchAllRows<NegocioParceiro>((from, to) =>
      supabase
        .from('negocios')
        .select('id, titulo, estagio, valor_estimado, data_previsao_fechamento, data_fechamento')
        .eq('desqualificado', false)
        .order('created_at', { ascending: false })
        .range(from, to)
    ),
  ])

  const total = negocios.reduce((acc, n) => acc + Number(n.valor_estimado ?? 0), 0)

  // Só as etapas que têm algo — o parceiro não precisa ver o funil inteiro vazio.
  const colunas = estagios
    .map((e) => ({ estagio: e, itens: negocios.filter((n) => n.estagio === e.slug) }))
    .filter((c) => c.itens.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
          Meus Negócios
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Negócios que você indicou, por estágio do funil.
        </p>
      </div>

      {negocios.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum negócio indicado por você até agora.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Negócios indicados</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{negocios.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Valor total estimado</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{BRL(total)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {colunas.map(({ estagio, itens }) => {
              const cor = corPorTipo(estagio.tipo)
              const subtotal = itens.reduce((acc, n) => acc + Number(n.valor_estimado ?? 0), 0)
              return (
                <section key={estagio.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${cor.dot}`} aria-hidden />
                    <h3 className="text-sm font-semibold text-foreground">{estagio.nome}</h3>
                    <span className="text-xs text-muted-foreground">
                      {itens.length} · {BRL(subtotal)}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {itens.map((n) => (
                      <li
                        key={n.id}
                        className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm font-medium text-foreground">{n.titulo}</span>
                        <span className="flex items-center gap-3 text-xs text-muted-foreground">
                          {n.data_fechamento
                            ? `Fechado em ${formatDate(n.data_fechamento)}`
                            : n.data_previsao_fechamento
                              ? `Previsão ${formatDate(n.data_previsao_fechamento)}`
                              : null}
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {BRL(Number(n.valor_estimado ?? 0))}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
