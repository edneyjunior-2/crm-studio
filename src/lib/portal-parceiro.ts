import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface ConteudoParceiro {
  temNegocios: boolean
  temProcessos: boolean
}

/**
 * O que o parceiro externo realmente tem — usado para mostrar só as abas com
 * conteúdo.
 *
 * Os dois tenants de hoje usam modelos opostos: na Aurumtax a indicação vive em
 * negocios.parceiro_id (funil), na Saturnino vive em
 * processos_juridicos.indicador_parceiro_id (casos). Um parceiro de escritório
 * jurídico nunca teria negócio, e um funil permanentemente vazio parece defeito.
 *
 * Guiar pelo DADO em vez de pela vertical do tenant faz isso funcionar sozinho
 * para quem usar os dois modelos ao mesmo tempo, sem `if vertical` no código.
 *
 * As contagens não precisam de filtro: a RLS do role 'parceiro' já escopa as
 * duas tabelas ao que é dele. `head: true` não traz linha, só o total.
 *
 * Memoizado por request (layout e dashboard consultam no mesmo render).
 * Falha de rede devolve `true` nos dois — mostrar uma aba a mais é bem melhor
 * que esconder a única aba que a pessoa tinha por causa de um blip.
 */
export const conteudoDoParceiro = cache(async (): Promise<ConteudoParceiro> => {
  const supabase = await createClient()
  try {
    const [negocios, processos] = await Promise.all([
      supabase.from('negocios').select('id', { count: 'exact', head: true }),
      supabase.from('processos_juridicos').select('id', { count: 'exact', head: true }),
    ])
    // O supabase-js NÃO lança em erro de query: devolve { error, count: null }.
    // Sem checar o error, `(null ?? 0) > 0` daria false nos dois e o menu do
    // parceiro degradaria em silêncio (ex.: no intervalo entre a migration e o
    // reload do schema cache do PostgREST). Fail-open explícito e logado.
    if (negocios.error || processos.error) {
      console.error(
        '[portal-parceiro] erro ao contar conteúdo do parceiro:',
        negocios.error?.message ?? processos.error?.message
      )
      return { temNegocios: true, temProcessos: true }
    }
    return {
      temNegocios: (negocios.count ?? 0) > 0,
      temProcessos: (processos.count ?? 0) > 0,
    }
  } catch (err) {
    console.error('[portal-parceiro] erro ao contar conteúdo do parceiro:', err)
    return { temNegocios: true, temProcessos: true }
  }
})

/**
 * Rota inicial do parceiro: a primeira aba que tem conteúdo E está liberada
 * para ele. `null` = não redirecione, mostre o estado vazio onde já está.
 *
 * Checar `modulosPermitidos` aqui não é zelo — é o que evita um loop infinito
 * que tranca o usuário fora do produto. O admin pode desmarcar um módulo do
 * parceiro em Configurações → Usuários; nesse caso requireModulo redireciona
 * pra /dashboard, e /dashboard é justamente quem chama esta função. Devolver um
 * destino não liberado fecharia o ciclo /dashboard → /rota → /dashboard
 * (ERR_TOO_MANY_REDIRECTS).
 *
 * Só o ramo de RBAC precisa deste cuidado: quando o módulo falta no PLANO,
 * requireModulo manda pra /upgrade, que não tem gate e portanto termina.
 *
 * Nunca devolver '/financeiro/comissoes': ela é gateada por
 * requireModulo('comissoes') e o dashboard é o único terminal sem gate.
 */
export function landingDoParceiro(
  conteudo: ConteudoParceiro,
  modulosPermitidos: string[] | null
): string | null {
  const liberado = (m: string) => modulosPermitidos == null || modulosPermitidos.includes(m)
  if (conteudo.temNegocios && liberado('pipeline')) return '/pipeline'
  if (conteudo.temProcessos && liberado('processos')) return '/processos'
  return null
}
