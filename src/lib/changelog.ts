/**
 * Changelog do CRM Studio.
 *
 * Ao lançar algo novo, adicione um Release NO TOPO do array com a data do dia.
 * Formato da data: 'YYYY-MM-DD'
 * O id deve ser único (sugestão: '<data>-<slug-curto>').
 *
 * `modulo` separa o que é relevante pra cada vertical — a tela de
 * Atualizações só mostra 'advocacia'/'engenharia' pra quem tem esse módulo
 * ativo (ver modulosEfetivos em src/lib/modulos.ts). Sem `modulo` (ou
 * 'geral') = aparece pra todo mundo, é a base comum (Vendas/Pipeline/
 * Financeiro/Clientes/Contratos etc.).
 */

export type ModuloChangelog = 'geral' | 'advocacia' | 'engenharia' | 'frete' | 'atendimento'

export interface Release {
  id: string
  /** Data de lançamento no formato 'YYYY-MM-DD' */
  data: string
  titulo: string
  itens: string[]
  tipo?: 'novidade' | 'melhoria' | 'correcao'
  /** Vertical a que o lançamento pertence. Ausente = 'geral' (todo mundo vê). */
  modulo?: ModuloChangelog
}

export const CHANGELOG: Release[] = [
  {
    id: '2026-07-17-atendimento-leila-nunca-fica-muda',
    data: '2026-07-17',
    titulo: 'A assistente de WhatsApp não deixa mais nenhum cliente sem resposta',
    tipo: 'correcao',
    modulo: 'atendimento',
    itens: [
      'Corrigimos uma falha em que, se acontecesse uma instabilidade momentânea (na conexão ou no serviço de inteligência), a mensagem do cliente ficava sem resposta e a assistente não tentava de novo — mesmo depois que tudo voltava ao normal',
      'Agora, se algo falhar na hora de responder, o sistema tenta de novo automaticamente até a mensagem ser de fato respondida — nenhum lead fica no vácuo',
    ],
  },
  {
    id: '2026-07-17-atendimento-agendamento-leila',
    data: '2026-07-17',
    titulo: 'Leila agora marca reunião de verdade, com confirmação da equipe',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'A assistente de WhatsApp deixa de "inventar" horário na conversa — ela consulta a agenda real (Google Calendar) de quem vai atender e só oferece horários realmente livres',
      'Toda reunião marcada por ela fica pendente até alguém da equipe confirmar dentro do CRM — um aviso aparece assim que você entra no sistema',
      'Depois de confirmada, o cliente recebe automaticamente a confirmação pelo WhatsApp — com o link da videochamada, se for o caso',
      'Se a reunião for recusada, a assistente volta a conversar sozinha com o cliente para oferecer outro horário',
    ],
  },
  {
    id: '2026-07-17-pipeline-lead-whatsapp',
    data: '2026-07-17',
    titulo: 'Lead qualificado pela Leila já entra certo no funil',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Quando a assistente de WhatsApp qualifica um lead, ele já entra direto na etapa de Qualificação do funil — não precisa mais mover manualmente da Prospecção',
      'Todo negócio que veio de uma conversa de WhatsApp ganha um selinho verde no card, para você identificar de onde ele veio',
    ],
  },
  {
    id: '2026-07-17-pipeline-card-legivel',
    data: '2026-07-17',
    titulo: 'Card do Pipeline mais fácil de ler',
    tipo: 'melhoria',
    modulo: 'geral',
    itens: [
      'Coluna do Kanban ficou mais larga e o título do negócio não fica mais cortado no meio da palavra',
      'No celular, os botões de ação (editar, excluir, registrar reunião...) continuam sempre visíveis e clicáveis — no computador, só aparecem quando o mouse passa por cima do card',
    ],
  },
  {
    id: '2026-07-17-atendimento-nao-lidas',
    data: '2026-07-17',
    titulo: 'Aviso de mensagem não lida no menu',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Chegou mensagem nova no WhatsApp? Um número vermelho aparece em cima do ícone "WhatsApp" no menu, mesmo se você estiver em outra tela do sistema',
      'Atualiza sozinho, sem precisar recarregar a página',
    ],
  },
  {
    id: '2026-07-17-atendimento-midia',
    data: '2026-07-17',
    titulo: 'Fotos e áudios do WhatsApp abrem direto na conversa',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Cliente mandou uma foto ou um áudio pelo WhatsApp? Agora abre direto na conversa dentro do CRM — imagem em miniatura, áudio com player — sem precisar abrir o WhatsApp separado',
    ],
  },
  {
    id: '2026-07-17-frete-piso-antt-preview',
    data: '2026-07-17',
    titulo: 'Cotação de frete mostra o piso ANTT ao vivo',
    tipo: 'melhoria',
    modulo: 'frete',
    itens: [
      'Ao preencher distância, tabela ANTT, tipo de carga e tipo de veículo, o piso mínimo já aparece na tela — antes mesmo de salvar a cotação',
      'Se a combinação escolhida ainda não tiver coeficiente ANTT cadastrado, o sistema já avisa antes de você preencher o resto do formulário',
    ],
  },
  {
    id: '2026-07-17-frete-modulo-novo',
    data: '2026-07-17',
    titulo: 'Novo módulo: Frete e Logística',
    tipo: 'novidade',
    modulo: 'frete',
    itens: [
      'Cadastre os veículos e motoristas da sua frota',
      'Registre cotações de frete com cálculo de referência do piso mínimo da ANTT (hoje cobrindo carga geral e granel sólido — mais tipos de carga a caminho)',
      'Busca de cidade por autocomplete (dados do IBGE) na origem e no destino da cotação',
      'Cotação aprovada vira negócio no funil comercial em 1 clique',
    ],
  },
  {
    id: '2026-07-17-contratos-editar-email-reenviar',
    data: '2026-07-17',
    titulo: 'Corrija o e-mail e reenvie o contrato',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Errou o e-mail de quem ia assinar? Agora dá pra corrigir direto pelo histórico e reenviar, sem começar tudo de novo',
      'Contratos enviados (ou recusados) ganham um botão de reenvio — antes só dava pra enviar contratos ainda não enviados',
    ],
  },
  {
    id: '2026-07-17-contratos-historico-tempo-real',
    data: '2026-07-17',
    titulo: 'Histórico de contratos mostra quem enviou e quem falta assinar',
    tipo: 'melhoria',
    modulo: 'geral',
    itens: [
      'O histórico agora mostra quem da sua equipe enviou cada contrato para assinatura',
      'Fica destacado, sem precisar clicar em nada, quem ainda não assinou',
      'A tela atualiza sozinha assim que alguém assina — sem precisar recarregar a página',
    ],
  },
  {
    id: '2026-07-15-contratos-assinatura-eletronica',
    data: '2026-07-15',
    titulo: 'Assinatura eletrônica dos contratos, direto no sistema',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Gere o contrato e envie para assinatura em 1 clique — sem imprimir, assinar à mão ou escanear',
      'Empresa com mais de um sócio? Adicione todos os responsáveis no contrato — cada um recebe o link de assinatura no próprio e-mail',
      'O responsável da sua empresa pelas assinaturas é cadastrado uma vez e entra automaticamente em todo contrato enviado',
      'O status do contrato (Enviado → Assinado) atualiza sozinho no histórico assim que todos assinarem',
    ],
  },
  {
    id: '2026-07-15-contratos-upload-documento',
    data: '2026-07-15',
    titulo: 'Envie qualquer documento pronto para assinatura',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Nova aba "Enviar documento" em Contratos: suba um PDF já pronto (feito fora do sistema) e mande para assinatura eletrônica',
      'Defina os signatários na hora do envio — cada um recebe o próprio link por e-mail',
    ],
  },
  {
    id: '2026-07-15-contratos-campo-desativado',
    data: '2026-07-15',
    titulo: 'Contrato com campo não preenchido sai certo',
    tipo: 'correcao',
    modulo: 'geral',
    itens: [
      'Um campo desmarcado no gerador (ex.: RG não informado) não aparece mais como texto bruto no documento final',
    ],
  },
  {
    id: '2026-07-13-calendario-sync-continua',
    data: '2026-07-13',
    titulo: 'Google Calendar sincroniza sozinho com o CRM',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Ao conectar sua conta Google, os compromissos dos últimos 7 dias e dos próximos 90 já entram automaticamente no Calendário',
      'Depois disso, criar, editar ou cancelar um evento no Google reflete no CRM sozinho, a cada ~15 minutos — sem precisar reconectar nada',
    ],
  },
  {
    id: '2026-07-10-djen-publicacoes',
    data: '2026-07-10',
    titulo: 'Publicações do Diário de Justiça direto no processo',
    tipo: 'novidade',
    modulo: 'advocacia',
    itens: [
      'Cadastre sua OAB em "Minha Conta" e o sistema passa a buscar automaticamente suas publicações no DJEN, casando cada uma com o processo certo pelo número CNJ',
      'Nova aba "Publicações" no detalhe do processo mostra tudo o que foi encontrado, com opção de buscar manualmente a qualquer momento',
    ],
  },
  {
    id: '2026-07-10-contratos-corrigido',
    data: '2026-07-10',
    titulo: 'Gerador de contratos personalizados corrigido',
    tipo: 'correcao',
    modulo: 'geral',
    itens: [
      'Empresas com modelo de contrato próprio (white-label) voltam a conseguir gerar contratos normalmente',
    ],
  },
  {
    id: '2026-07-10-chamados-numeracao',
    data: '2026-07-10',
    titulo: 'Chamados de suporte ganham número',
    tipo: 'melhoria',
    modulo: 'geral',
    itens: [
      'Ao reportar um problema pelo botão "Teve um problema?", o chamado recebe um número (#001, #002...) pra facilitar a referência',
    ],
  },
  {
    id: '2026-07-10-clientes-tabela',
    data: '2026-07-10',
    titulo: 'Lista de clientes mais fácil de usar',
    tipo: 'melhoria',
    modulo: 'geral',
    itens: [
      'Clique em qualquer parte da linha do cliente para editar, sem precisar mirar no lápis',
      'Coluna "Ações" fica fixa na tela ao rolar a tabela pros lados, em qualquer tamanho de tela',
    ],
  },
  {
    id: '2026-07-10-processos-vinculos',
    data: '2026-07-10',
    titulo: 'Mais controle sobre clientes e indicação nos processos',
    tipo: 'melhoria',
    modulo: 'advocacia',
    itens: [
      'Um processo pode ter mais de um cliente vinculado, além do principal',
      'Vincule manualmente o parceiro que indicou o processo, direto no cadastro',
      'Área do direito: ao escolher "Outro", digite livremente com sugestões das áreas já usadas na empresa',
      'Seletor de clientes reorganizado: quem já foi selecionado fica fixo no topo, com busca separada pra adicionar mais',
    ],
  },
  {
    id: '2026-07-09-calendario-eventos',
    data: '2026-07-09',
    titulo: 'Eventos privados e Google Meet automático no Calendário',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Novo toggle "Visível para a equipe" ao criar um evento — por padrão, só você vê',
      'Link do Google Meet gerado automaticamente nos seus eventos',
      'Campo de repetição (semanal, mensal, anual) volta a funcionar de verdade ao criar um evento novo',
    ],
  },
  {
    id: '2026-07-09-prazos-melhorias',
    data: '2026-07-09',
    titulo: 'Prazos processuais mais fáceis de acompanhar',
    tipo: 'melhoria',
    modulo: 'advocacia',
    itens: [
      'Clique em qualquer parte da linha de um prazo pra abrir o processo direto',
      'Audiências que já aconteceram somem da lista de Prazos automaticamente',
    ],
  },
  {
    id: '2026-07-09-ajustes-diversos',
    data: '2026-07-09',
    titulo: 'Ajustes de estabilidade',
    tipo: 'correcao',
    modulo: 'geral',
    itens: [
      'Removidos aniversários de exemplo que apareciam no Calendário de todas as empresas',
      'Toggle de personalizar menu (Configurações) volta a ativar/desativar módulos corretamente',
      'Ao marcar um chamado como resolvido, quem reportou recebe um e-mail avisando',
    ],
  },
  {
    id: '2026-07-08-calendario-prazos',
    data: '2026-07-08',
    titulo: 'Prazos e audiências no Calendário',
    tipo: 'novidade',
    modulo: 'advocacia',
    itens: [
      'Nova aba "Prazos" no Calendário reúne prazos processuais e audiências de todos os processos num só lugar',
    ],
  },
  {
    id: '2026-07-08-timbrado',
    data: '2026-07-08',
    titulo: 'Papel timbrado nos contratos gerados',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Configure o timbrado da sua empresa em Configurações — passa a aparecer nos PDFs gerados pelo sistema',
    ],
  },
  {
    id: '2026-07-08-processos-organizacao',
    data: '2026-07-08',
    titulo: 'Processos mais simples de acompanhar',
    tipo: 'melhoria',
    modulo: 'advocacia',
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
    modulo: 'advocacia',
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
    modulo: 'geral',
    itens: [
      'Desqualificar um negócio agora manda ele direto pra 3ª aba do histórico, sem ocupar espaço no funil',
    ],
  },
  {
    id: '2026-07-08-cliente-cpf',
    data: '2026-07-08',
    titulo: 'CPF aparece certo no cadastro de cliente',
    tipo: 'correcao',
    modulo: 'geral',
    itens: [
      'Clientes pessoa física agora mostram o CPF corretamente (antes a tela só considerava CNPJ)',
    ],
  },
  {
    id: '2026-07-07-parceiro-externo',
    data: '2026-07-07',
    titulo: 'Portal para parceiros externos',
    tipo: 'novidade',
    modulo: 'advocacia',
    itens: [
      'Convide por e-mail um parceiro externo (quem indicou o processo) — ele acessa, em modo leitura, só os processos vinculados a ele',
    ],
  },
  {
    id: '2026-07-07-pipeline-solucoes',
    data: '2026-07-07',
    titulo: 'Pipeline com campos obrigatórios configuráveis',
    tipo: 'melhoria',
    modulo: 'geral',
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
    modulo: 'geral',
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
    modulo: 'geral',
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
    modulo: 'geral',
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
    modulo: 'geral',
    itens: ['Login com a conta Google direto na tela de acesso'],
  },
  {
    id: '2026-06-30-lembrete',
    data: '2026-06-30',
    titulo: 'Lembretes no Google Calendar',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Crie um lembrete de follow-up no negócio que vai direto para o seu Google Calendar',
    ],
  },
  {
    id: '2026-06-30-saude-financeira',
    data: '2026-06-30',
    titulo: 'Painel de Saúde Financeira',
    tipo: 'novidade',
    modulo: 'geral',
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
    modulo: 'engenharia',
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
    modulo: 'geral',
    itens: [
      'Ao ganhar um negócio, gere conta a receber + comissão prevista em 1 clique',
    ],
  },
  {
    id: '2026-06-30-pipeline',
    data: '2026-06-30',
    titulo: 'Melhorias no funil de vendas',
    tipo: 'melhoria',
    modulo: 'geral',
    itens: [
      'Etapas do funil customizáveis por empresa',
      'Reabrir/excluir negócios no histórico',
      'Eventos do Google Calendar limpos ao excluir negócio',
    ],
  },
]

/**
 * Filtra o changelog pelos módulos ativos da empresa — mesma regra usada na
 * tela de Atualizações: 'geral' (ou sem `modulo`) sempre aparece; vertical
 * só aparece pra quem tem o módulo correspondente ativo.
 */
export function changelogVisivel(modulosAtivos: string[] | Set<string>): Release[] {
  const ativos = modulosAtivos instanceof Set ? modulosAtivos : new Set(modulosAtivos)
  return CHANGELOG.filter((release) => {
    if (!release.modulo || release.modulo === 'geral') return true
    if (release.modulo === 'advocacia') return ativos.has('processos')
    if (release.modulo === 'engenharia') return ativos.has('obras')
    if (release.modulo === 'frete') return ativos.has('frete')
    if (release.modulo === 'atendimento') return ativos.has('atendimentos')
    return true
  })
}

/**
 * ID do lançamento mais recente VISÍVEL pra esta empresa — usado para
 * comparar com o localStorage (dot de "novidade" na sidebar). Sem isso, uma
 * empresa sem Advocacia/Engenharia ficaria marcada como "tem novidade" por
 * um lançamento de vertical que ela nunca vê na tela de Atualizações.
 */
export function ultimaAtualizacaoVisivel(modulosAtivos: string[] | Set<string>): string {
  return changelogVisivel(modulosAtivos)[0]?.id ?? ''
}
