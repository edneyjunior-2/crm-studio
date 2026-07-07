import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export interface ClienteDaSolucao {
  cliente_id: string
  razao_social: string
  contato_nome: string | null
  contato_email: string | null
  contato_telefone: string | null
  numero_negocios: number
  valor_total: number
}

interface NegocioDireto {
  id: string
  cliente_id: string
  valor_estimado: number | string | null
}

interface ProdutoComNegocio {
  negocio_id: string
  valor: number | string
  // Client sem Database genérico: supabase-js infere embeds como array mesmo em
  // relações many-to-one (FK do lado de negocio_produtos). Em runtime o PostgREST
  // devolve um único objeto — normalizado em clienteIdDoEmbed().
  negocios: { cliente_id: string }[] | null
}

function clienteIdDoEmbed(negocios: ProdutoComNegocio['negocios']): string | null {
  if (!negocios) return null
  return Array.isArray(negocios) ? (negocios[0]?.cliente_id ?? null) : ((negocios as { cliente_id: string }).cliente_id ?? null)
}

interface ClienteRow {
  id: string
  razao_social: string
  contato_nome: string | null
  contato_email: string | null
  contato_telefone: string | null
}

/**
 * Clientes distintos com negócios vinculados a uma solução — com contagem de
 * negócios e valor total estimado por cliente. Ordenado por valor total (desc).
 *
 * Um negócio se vincula a uma solução de duas formas (ver negocio_produtos, que
 * permite um negócio ter várias linhas de produto/solução — ex.: recuperação
 * tributária = Previdenciária + Fazendária no mesmo negócio):
 *   1. negocios.solucao_id = id          → vínculo "principal" do negócio
 *   2. negocio_produtos.solucao_id = id  → linha de produto específica
 * Cada negócio conta UMA vez mesmo se casar nos dois. O valor atribuído a ele
 * nesta solução usa a soma das linhas de produto quando existirem (mais preciso
 * quando o negócio combina produtos de soluções diferentes, cada um com seu
 * próprio valor); só cai para negocios.valor_estimado quando não há nenhuma
 * linha de produto para essa solução (negócios antigos, anteriores à feature de
 * múltiplos produtos).
 *
 * Agrega em memória a partir do conjunto COMPLETO (fetchAllRows pagina via
 * .range(), contornando o cap de 1000 linhas do PostgREST) — nunca soma/conta
 * sobre uma página truncada. RLS (current_empresa_id()) já isola por tenant.
 */
export async function listarClientesDaSolucao(solucaoId: string): Promise<ClienteDaSolucao[]> {
  const supabase = await createClient()

  const [negociosDiretos, produtosDaSolucao] = await Promise.all([
    fetchAllRows<NegocioDireto>((from, to) =>
      supabase
        .from('negocios')
        .select('id, cliente_id, valor_estimado')
        .eq('solucao_id', solucaoId)
        .range(from, to),
    ),
    fetchAllRows<ProdutoComNegocio>((from, to) =>
      supabase
        .from('negocio_produtos')
        .select('negocio_id, valor, negocios!inner(cliente_id)')
        .eq('solucao_id', solucaoId)
        .range(from, to),
    ),
  ])

  // negocio_id -> soma das linhas de produto desta solução, e cliente (via embed)
  const valorPorProdutoNegocio = new Map<string, number>()
  const clientePorNegocioViaProduto = new Map<string, string>()
  for (const p of produtosDaSolucao) {
    const clienteId = clienteIdDoEmbed(p.negocios)
    if (!clienteId) continue
    valorPorProdutoNegocio.set(
      p.negocio_id,
      (valorPorProdutoNegocio.get(p.negocio_id) ?? 0) + Number(p.valor ?? 0),
    )
    clientePorNegocioViaProduto.set(p.negocio_id, clienteId)
  }

  // Une os dois vínculos: negocio_id -> { cliente_id, valor atribuído a esta solução }
  const negocioParaCliente = new Map<string, string>()
  const negocioParaValor = new Map<string, number>()

  for (const n of negociosDiretos) {
    negocioParaCliente.set(n.id, n.cliente_id)
    negocioParaValor.set(n.id, valorPorProdutoNegocio.get(n.id) ?? Number(n.valor_estimado ?? 0))
  }
  for (const [negocioId, clienteId] of clientePorNegocioViaProduto) {
    if (!negocioParaCliente.has(negocioId)) {
      negocioParaCliente.set(negocioId, clienteId)
      negocioParaValor.set(negocioId, valorPorProdutoNegocio.get(negocioId) ?? 0)
    }
  }

  if (negocioParaCliente.size === 0) return []

  // Agrupa por cliente
  const porCliente = new Map<string, { numero_negocios: number; valor_total: number }>()
  for (const [negocioId, clienteId] of negocioParaCliente) {
    const atual = porCliente.get(clienteId) ?? { numero_negocios: 0, valor_total: 0 }
    atual.numero_negocios += 1
    atual.valor_total += negocioParaValor.get(negocioId) ?? 0
    porCliente.set(clienteId, atual)
  }

  const clienteIds = [...porCliente.keys()]
  const clientes = await fetchAllRows<ClienteRow>((from, to) =>
    supabase
      .from('clientes')
      .select('id, razao_social, contato_nome, contato_email, contato_telefone')
      .in('id', clienteIds)
      .range(from, to),
  )

  return clientes
    .map((c) => {
      const agregado = porCliente.get(c.id)
      return {
        cliente_id: c.id,
        razao_social: c.razao_social,
        contato_nome: c.contato_nome,
        contato_email: c.contato_email,
        contato_telefone: c.contato_telefone,
        numero_negocios: agregado?.numero_negocios ?? 0,
        valor_total: agregado?.valor_total ?? 0,
      }
    })
    .sort((a, b) => b.valor_total - a.valor_total)
}
