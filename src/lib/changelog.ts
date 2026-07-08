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
    id: '2026-07-08-calendario-prazos',
    data: '2026-07-08',
    titulo: 'Prazos e audiências no Calendário',
    tipo: 'novidade',
    itens: [
      'Nova aba "Prazos" no Calendário reúne prazos processuais e audiências de todos os processos num só lugar',
    ],
  },
  {
    id: '2026-07-08-timbrado',
    data: '2026-07-08',
    titulo: 'Papel timbrado nos contratos gerados',
    tipo: 'novidade',
    itens: [
      'Configure o timbrado da sua empresa em Configurações — passa a aparecer nos PDFs gerados pelo sistema',
    ],
  },
  {
    id: '2026-07-08-processos-organizacao',
    data: '2026-07-08',
    titulo: 'Processos mais simples de acompanhar',
    tipo: 'melhoria',
    itens: [
      'Situação do processo passa a ter só 3 estados: Em andamento, Suspenso ou Concluído',
      'Movimentação com data futura (ex.: publicação agendada pelo tribunal) ganha um aviso explicando — não é erro do sistema',
    ],
  },
  {
    id: '2026-07-08-datajud-sync',
    data: '2026-07-08',
    titulo: 'Sincronização com o DataJud mais rápida e confiável',
    tipo: 'melhoria',
    itens: [
      'Processos de tribunais mais lentos, que travavam sem atualizar, voltam a sincronizar normalmente',
      'A atualização passa a rodar de madrugada — os processos já chegam atualizados no início do expediente',
    ],
  },
  {
    id: '2026-07-08-pipeline-desqualificado',
    data: '2026-07-08',
    titulo: 'Negócio desqualificado sai do Kanban',
    tipo: 'melhoria',
    itens: [
      'Desqualificar um negócio agora manda ele direto pra 3ª aba do histórico, sem ocupar espaço no funil',
    ],
  },
  {
    id: '2026-07-08-cliente-cpf',
    data: '2026-07-08',
    titulo: 'CPF aparece certo no cadastro de cliente',
    tipo: 'correcao',
    itens: [
      'Clientes pessoa física agora mostram o CPF corretamente (antes a tela só considerava CNPJ)',
    ],
  },
  {
    id: '2026-07-07-parceiro-externo',
    data: '2026-07-07',
    titulo: 'Portal para parceiros externos',
    tipo: 'novidade',
    itens: [
      'Convide por e-mail um parceiro externo (quem indicou o processo) — ele acessa, em modo leitura, só os processos vinculados a ele',
    ],
  },
  {
    id: '2026-07-07-pipeline-solucoes',
    data: '2026-07-07',
    titulo: 'Pipeline com campos obrigatórios configuráveis',
    tipo: 'melhoria',
    itens: [
      'Escolha em Configurações se cliente e/ou produto são obrigatórios para criar um negócio no funil',
      'Botão de cliente no formulário do negócio agora abre a busca de clientes já cadastrados ou permite cadastrar um novo sem sair da tela',
      'Extrato em PDF por solução, com filtro de clientes vinculados',
    ],
  },
  {
    id: '2026-07-03-contratos-modelos',
    data: '2026-07-03',
    titulo: 'Dois modelos de contrato de parceria',
    tipo: 'novidade',
    itens: [
      'Escolha entre o modelo novo e o antigo de Contrato de Parceria direto nas abas',
      'Botão "Minuta de Contrato" gera um rascunho em 1 clique, com selo "MINUTA — sujeita a revisão"',
    ],
  },
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
