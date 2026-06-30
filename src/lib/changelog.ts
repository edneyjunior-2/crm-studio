/**
 * Changelog do CRM Studio.
 *
 * Ao lançar algo novo, adicione um Release NO TOPO do array com a data do dia.
 * Formato da data: 'YYYY-MM-DD'
 * O id deve ser único (sugestão: '<data>-<slug-curto>').
 */

export interface Release {
  id: string
  /** Data de lançamento no formato 'YYYY-MM-DD' */
  data: string
  titulo: string
  itens: string[]
  tipo?: 'novidade' | 'melhoria' | 'correcao'
}

export const CHANGELOG: Release[] = [
  {
    id: '2026-06-30-saude-financeira',
    data: '2026-06-30',
    titulo: 'Painel de Saúde Financeira',
    tipo: 'novidade',
    itens: [
      'Posição líquida projetada (caixa + a receber − a pagar)',
      'DRE gerencial do mês (receitas − despesas por categoria)',
      'Nova aba "Saúde Financeira" no menu Financeiro',
    ],
  },
  {
    id: '2026-06-30-medicao',
    data: '2026-06-30',
    titulo: 'Medição vira boletim físico-financeiro',
    tipo: 'novidade',
    itens: [
      'Medição ligada ao orçamento, com % por etapa',
      'Boletim (orçado × medido) e curva S de avanço',
    ],
  },
  {
    id: '2026-06-30-fechamento',
    data: '2026-06-30',
    titulo: 'Fechar negócio gera o financeiro',
    tipo: 'melhoria',
    itens: [
      'Ao ganhar um negócio, gere conta a receber + comissão prevista em 1 clique',
    ],
  },
  {
    id: '2026-06-30-pipeline',
    data: '2026-06-30',
    titulo: 'Melhorias no funil de vendas',
    tipo: 'melhoria',
    itens: [
      'Etapas do funil customizáveis por empresa',
      'Reabrir/excluir negócios no histórico',
      'Eventos do Google Calendar limpos ao excluir negócio',
    ],
  },
]

/** ID do lançamento mais recente — usado para comparar com o localStorage. */
export const ULTIMA_ATUALIZACAO = CHANGELOG[0]?.id ?? ''
