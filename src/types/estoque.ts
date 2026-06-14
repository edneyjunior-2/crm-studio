export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste'

export interface Produto {
  id: string
  empresa_id: string
  nome: string
  sku: string | null
  unidade: string
  custo_medio: number
  preco_venda: number
  estoque_minimo: number
  saldo_atual: number
  ativo: boolean
  created_by: string | null
  created_at: string
}

export interface MovimentacaoEstoque {
  id: string
  empresa_id: string
  produto_id: string
  tipo: TipoMovimentacao
  quantidade: number
  custo_unitario: number | null
  motivo: string | null
  negocio_id: string | null
  data: string
  created_by: string | null
  created_at: string
  /** Joined — disponível em queries com select produto:produtos(nome) */
  produtos?: Pick<Produto, 'id' | 'nome' | 'unidade'> | null
}
