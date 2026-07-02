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
    id: '2026-07-02-financeiro-fechamento',
    data: '2026-07-02',
    titulo: 'Financeiro do fechamento se ajusta sozinho',
    tipo: 'melhoria',
    itens: [
      'Reabriu um negócio ganho? A conta a receber e a comissão ainda não recebidas são estornadas automaticamente',
      'Editou o valor de um negócio já ganho? A conta a receber e a comissão previstas são atualizadas com o novo valor',
      'Contas já recebidas e comissões já pagas nunca são alteradas',
      'Fechar o mesmo negócio duas vezes não gera mais lançamentos duplicados',
    ],
  },
  {
    id: '2026-06-30-historico-busca',
    data: '2026-06-30',
    titulo: 'Histórico de negócios com abas e busca',
    tipo: 'melhoria',
    itens: [
      'Abas selecionáveis "Perdidos" e "Ganhos" no histórico',
      'Campo de busca por cliente, título, solução ou responsável',
      'Negócios fechados saem do funil na virada do mês e ficam arquivados no histórico',
      'Clique no negócio para ver a linha do tempo do processo',
    ],
  },
  {
    id: '2026-06-30-login-google',
    data: '2026-06-30',
    titulo: 'Entrar com Google',
    tipo: 'novidade',
    itens: ['Login com a conta Google direto na tela de acesso'],
  },
  {
    id: '2026-06-30-lembrete',
    data: '2026-06-30',
    titulo: 'Lembretes no Google Calendar',
    tipo: 'novidade',
    itens: [
      'Crie um lembrete de follow-up no negócio que vai direto para o seu Google Calendar',
    ],
  },
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
