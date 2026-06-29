import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Busca TODAS as linhas de uma query paginando com `.range()`, contornando o cap
 * de ~1000 linhas do PostgREST (`db-max-rows`). Use quando precisa do conjunto
 * COMPLETO para somar / agrupar / listar / exportar — NUNCA conte/agregue em cima
 * de um `.select()` cru (vem truncado em 1000, silenciosamente).
 *
 * `makeQuery` deve devolver uma query Supabase FRESCA a cada chamada, já com
 * `.select()`/`.order()`/filtros + `.range(from, to)` aplicado:
 *
 *   const rows = await fetchAllRows<Row>((from, to) =>
 *     supabase.from('clientes').select('razao_social, cnpj').order('razao_social').range(from, to)
 *   )
 *
 * Lança em erro de banco (trate no chamador conforme o contexto: 500 em API route,
 * try/catch + default em RSC se o original tolerava falha).
 *
 * ponytail: puxa todas as linhas para o app — correto, mas para SOMA em tabela
 * muito grande um aggregate no banco (RPC/view) é mais barato. Trocar nos pontos
 * quentes só se a contagem de linhas por tenant crescer a ponto de pesar.
 */
export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await makeQuery(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}
