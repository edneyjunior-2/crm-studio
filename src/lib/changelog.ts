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
    id: '2026-07-22-banco-de-horas-justificativa',
    data: '2026-07-22',
    titulo: 'Cartão de Ponto agora mostra quem deve horas a quem',
    tipo: 'novidade',
    modulo: 'engenharia',
    itens: [
      'O Cartão de Ponto compara o horário batido de cada dia com a jornada esperada e mostra o saldo do mês em uma frase simples — "a empresa deve X horas" ou "fulano deve X horas à empresa" — sem precisar fazer conta.',
      'Qualquer dia (não só falta) agora pode ser justificado pelo RH — atestado médico, atestado de comparecimento, liberação da empresa ou uma observação livre, com anexo opcional — e um dia justificado deixa de contar como pendência.',
    ],
  },
  {
    id: '2026-07-22-cartao-de-ponto',
    data: '2026-07-22',
    titulo: 'Cartão de Ponto: entenda o ponto da sua equipe sem precisar decifrar planilha',
    tipo: 'novidade',
    modulo: 'engenharia',
    itens: [
      'Em RH › Ponto Diário › Cartão de Ponto, escolha um colaborador e um mês pra ver, dia a dia, se ele trabalhou, faltou, apresentou atestado ou tirou folga — com o horário batido e o total de horas, em uma lista simples e colorida, sem sigla nem termo técnico.',
    ],
  },
  {
    id: '2026-07-22-nomes-perfis-personalizaveis',
    data: '2026-07-22',
    titulo: 'Dá pra renomear os perfis de acesso da equipe',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Em Configurações › Usuários, clique no nome de um perfil (Administrador, Sócio, Comercial ou Parceiro) pra chamar ele do jeito que faz mais sentido pro seu negócio — por exemplo, "Técnico de Campo" numa empresa de engenharia, ou "Advogado" num escritório. As permissões de cada um continuam as mesmas, só o nome muda.',
    ],
  },
  {
    id: '2026-07-21-som-notificacao-whatsapp',
    data: '2026-07-21',
    titulo: 'Um bipe avisa quando chega mensagem nova de WhatsApp',
    tipo: 'melhoria',
    modulo: 'atendimento',
    itens: [
      'Agora, ao chegar uma mensagem nova de WhatsApp, um som curto toca — dá pra perceber sem precisar ficar de olho na tela o tempo todo',
    ],
  },
  {
    id: '2026-07-21-whatsapp-numero-sem-duplicar-conversa',
    data: '2026-07-21',
    titulo: 'Corrigido: podia abrir uma conversa duplicada pro mesmo contato',
    tipo: 'correcao',
    modulo: 'atendimento',
    itens: [
      'Digitar o número de um contato que já tinha conversa (mesmo em formato ligeiramente diferente) não abre mais um chat novo e separado — o sistema reconhece que já existe conversa com aquele número e reusa a mesma',
    ],
  },
  {
    id: '2026-07-21-financeiro-aba-honorarios',
    data: '2026-07-21',
    titulo: 'Nova aba Honorários no Financeiro',
    tipo: 'novidade',
    modulo: 'advocacia',
    itens: [
      'Na tela do processo, um botão "Lançar honorário" manda o valor direto para uma conta a receber, sem precisar digitar tudo de novo em Financeiro',
      'A nova aba Honorários mostra o que já foi recebido (mês a mês), o que ainda está esperando pagamento, e uma projeção do que os processos em aberto ainda podem render',
    ],
  },
  {
    id: '2026-07-21-calendario-prazos-editavel',
    data: '2026-07-21',
    titulo: 'Prazos do Calendário agora são editáveis, com calendário de mês',
    tipo: 'melhoria',
    modulo: 'advocacia',
    itens: [
      'Na aba Prazos do Calendário, agora dá para mudar a data, marcar como cumprido ou excluir um prazo direto ali, sem precisar abrir o processo',
      'Um calendário mensal novo, só com os prazos, aparece logo abaixo da lista — navegue entre os meses e clique num prazo para editar',
    ],
  },
  {
    id: '2026-07-21-processos-segundo-advogado-responsavel',
    data: '2026-07-21',
    titulo: 'Processos agora podem ter 2 advogados responsáveis',
    tipo: 'novidade',
    modulo: 'advocacia',
    itens: [
      'Em "Editar processo", agora dá para definir um 2º advogado responsável, além do principal',
      'A busca automática de publicações no Diário de Justiça (DJEN) passa a considerar a OAB dos dois responsáveis do processo, sem gerar publicação duplicada',
    ],
  },
  {
    id: '2026-07-21-responder-whatsapp-conversa-aberta',
    data: '2026-07-21',
    titulo: 'Responder mensagens de WhatsApp direto pelo CRM voltou a funcionar',
    tipo: 'correcao',
    modulo: 'atendimento',
    itens: [
      'Ao responder uma conversa já aberta no Atendimento, a mensagem agora é enviada de verdade pelo WhatsApp do cliente — antes ficava travada com um aviso de "integração não configurada"',
    ],
  },
  {
    id: '2026-07-21-nova-conversa-avisa-antes-de-tentar',
    data: '2026-07-21',
    titulo: '"Nova conversa" já avisa quando o contato exige mensagem-modelo',
    tipo: 'melhoria',
    modulo: 'atendimento',
    itens: [
      'Ao digitar o número de um contato que nunca falou com você (ou que esfriou há mais de 24h), a tela já avisa antes de você tentar mandar a mensagem — e o botão já manda direto a mensagem-modelo aprovada, sem a tentativa que ia falhar de qualquer jeito',
    ],
  },
  {
    id: '2026-07-21-atendimento-reabrir-com-template-na-resposta',
    data: '2026-07-21',
    titulo: 'Cliente esfriou? Agora dá para reabrir a conversa sem sair da tela',
    tipo: 'melhoria',
    modulo: 'atendimento',
    itens: [
      'Se o cliente não fala com você há mais de 24h e o WhatsApp bloqueia o envio de texto livre, a tela agora oferece o botão "Reabrir conversa" — que manda a mensagem-modelo aprovada na hora, sem precisar abrir "Nova conversa" de novo',
    ],
  },
  {
    id: '2026-07-20-contratos-signatario-vira-cliente',
    data: '2026-07-20',
    titulo: 'Corrigido: quem assina o contrato virava parceiro, não cliente',
    tipo: 'correcao',
    modulo: 'advocacia',
    itens: [
      'No Gerador de Contratos, os dados de quem assina o contrato agora são cadastrados automaticamente como Cliente do escritório — antes iam, por engano, para a lista de Parceiros',
    ],
  },
  {
    id: '2026-07-20-versao-do-sistema',
    data: '2026-07-20',
    titulo: 'Agora você vê a versão do CRM Studio',
    tipo: 'novidade',
    itens: [
      'Em Minha Conta, um selo mostra a versão atual do sistema — sinal de que o CRM Studio está sempre evoluindo',
    ],
  },
  {
    id: '2026-07-20-portal-parceiro-processos',
    data: '2026-07-20',
    titulo: 'Quem indica casos para o escritório agora acompanha pelo portal',
    tipo: 'novidade',
    modulo: 'advocacia',
    itens: [
      'O parceiro que indicou um processo passa a ver esse processo no portal dele, sem precisar ligar para o escritório perguntar como está',
      'Ele vê só a capa do processo — nada de andamentos, prazos, documentos ou anotações internas',
      'O portal mostra apenas as abas que fazem sentido para cada parceiro: quem indica processos vê Processos, quem indica negócios vê o funil, e ninguém fica com uma aba vazia na tela',
    ],
  },
  {
    id: '2026-07-20-atendimento-envio-midia',
    data: '2026-07-20',
    titulo: 'Envie foto, áudio ou PDF direto no Atendimento',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Agora dá para mandar uma imagem, um áudio ou um documento PDF para o cliente sem sair do Atendimento — clique no clipe ao lado da caixa de mensagem',
      'O que você digitou na caixa antes de anexar vira a legenda da foto ou do documento enviado',
    ],
  },
  {
    id: '2026-07-20-atendimento-confirmacao-leitura',
    data: '2026-07-20',
    titulo: 'O cliente agora vê quando você leu e está respondendo',
    tipo: 'melhoria',
    modulo: 'atendimento',
    itens: [
      'Ao abrir uma conversa, a mensagem do cliente é marcada como lida de verdade no WhatsApp dele (os dois tracinhos azuis) e ele vê "digitando…" enquanto você responde',
    ],
  },
  {
    id: '2026-07-20-atendimento-status-entrega',
    data: '2026-07-20',
    titulo: 'Saiba se sua mensagem chegou e foi lida',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Cada mensagem que você envia agora mostra um indicador: enviada, entregue ou já lida pelo cliente — igual ao WhatsApp do celular',
      'Se uma mensagem falhar ao entregar, aparece um aviso com o motivo direto no balão',
    ],
  },
  {
    id: '2026-07-20-atendimento-perfil-whatsapp-completo',
    data: '2026-07-20',
    titulo: 'Complete o perfil da sua empresa no WhatsApp',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Em Configurações, além da foto, agora dá para preencher a frase de status, a descrição da empresa, o endereço, o e-mail e o site que aparecem no seu perfil comercial do WhatsApp',
    ],
  },
  {
    id: '2026-07-20-atendimento-video-documento',
    data: '2026-07-20',
    titulo: 'Vídeos e documentos recebidos agora aparecem melhor no Atendimento',
    tipo: 'melhoria',
    modulo: 'atendimento',
    itens: [
      'Vídeos enviados pelo cliente já tocam direto na conversa, sem precisar baixar',
      'Documentos aparecem com um ícone e o tipo do arquivo, em vez de um link genérico "Ver anexo"',
    ],
  },
  {
    id: '2026-07-20-portal-parceiro',
    data: '2026-07-20',
    titulo: 'Portal do parceiro: ele acompanha os negócios que indicou e o que tem a receber',
    tipo: 'novidade',
    modulo: 'geral',
    itens: [
      'Quem você cadastra como parceiro agora pode ter acesso ao sistema e ver, sozinho, os negócios que indicou — sem precisar te ligar pra perguntar como está o andamento',
      'Na aba Financeiro o parceiro vê só as próprias comissões, separadas entre o que ainda tem a receber e o que já foi pago',
      'Ele enxerga exclusivamente o que é dele: nada da sua carteira de clientes, do seu funil completo ou do financeiro do escritório',
      'Para ligar um parceiro ao acesso, edite o cadastro dele em Parceiros e escolha o usuário no campo "Acesso ao portal"',
    ],
  },
  {
    id: '2026-07-20-atendimento-remove-numero-tecnico',
    data: '2026-07-20',
    titulo: 'Tela de Atendimento mais limpa',
    tipo: 'melhoria',
    modulo: 'atendimento',
    itens: [
      'Removemos o código técnico do WhatsApp que aparecia no topo da tela de Atendimento — ele não servia pra nada no seu dia a dia',
    ],
  },
  {
    id: '2026-07-20-atendimento-arquivar-conversas',
    data: '2026-07-20',
    titulo: 'Organize seu Atendimento: agora dá para arquivar conversas',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Conversas antigas ou encerradas não precisam mais ocupar espaço na sua lista: abra a conversa e clique em "Arquivar"',
      'Uma nova aba "Arquivadas" guarda tudo o que você arquivou — nada é apagado, e dá para desarquivar a qualquer momento',
    ],
  },
  {
    id: '2026-07-20-atendimento-foto-empresa-whatsapp',
    data: '2026-07-20',
    titulo: 'Defina a foto da sua empresa no WhatsApp direto pelo CRM',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Em Configurações, agora você envia a foto de perfil da sua empresa no WhatsApp — é a foto que seus clientes veem quando conversam com você por lá',
      'A tela mostra a foto atual do seu número e avisa quando a troca foi aceita (pode levar alguns minutos para atualizar no celular dos clientes)',
    ],
  },
  {
    id: '2026-07-20-contratos-assinatura-remetente-correto',
    data: '2026-07-20',
    titulo: 'E-mail de assinatura mostra o nome do seu escritório, não um e-mail avulso',
    tipo: 'correcao',
    itens: [
      'Quando você manda um contrato para assinatura, o e-mail que a pessoa recebe agora mostra o nome da sua empresa como remetente, em vez de um e-mail que ela não reconhece',
      'O aviso de "documento assinado" agora vai para quem enviou o contrato — não chega mais um e-mail avulso pra outra pessoa a cada assinatura concluída',
    ],
  },
  {
    id: '2026-07-20-gerador-contratos-dropdown-ilegivel',
    data: '2026-07-20',
    titulo: 'Corrigido: campos como Estado Civil ficavam ilegíveis no Gerador de Contratos',
    tipo: 'correcao',
    itens: [
      'Em alguns computadores (dependendo do tema claro/escuro do navegador), as opções de campos como Sexo, Estado Civil e Cargo apareciam com o texto quase invisível ao abrir a lista — agora o campo sempre mostra as opções com contraste correto, não importa o tema do seu navegador',
    ],
  },
  {
    id: '2026-07-20-clientes-editar-dados-em-branco',
    data: '2026-07-20',
    titulo: 'Corrigido: editar cliente abria com os campos em branco',
    tipo: 'correcao',
    itens: [
      'Ao clicar no lápis de editar na lista de Clientes, os dados do cliente já vêm preenchidos na janela — antes, em alguns casos, o formulário abria vazio mesmo com o cliente já cadastrado',
    ],
  },
  {
    id: '2026-07-20-atendimento-reabrir-conversa-24h',
    data: '2026-07-20',
    titulo: 'Reabra uma conversa parada há mais de 24h com um clique',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Quando um cliente não fala com você há mais de 24 horas, o WhatsApp bloqueia o envio de uma mensagem livre — agora dá para reabrir a conversa com um clique',
      'Ao reabrir, é enviada uma mensagem-modelo aprovada avisando que você está retomando o contato; assim que o cliente responder, vocês voltam a conversar livremente',
    ],
  },
  {
    id: '2026-07-20-configuracoes-mais-limpa',
    data: '2026-07-20',
    titulo: 'Tela de Configurações mais simples',
    tipo: 'melhoria',
    itens: [
      'Tiramos da tela do Agente SDR um campo técnico de integração que não era pra você mexer — a configuração continua funcionando normalmente por trás',
      'A seção de Privacidade & Dados (LGPD) agora começa recolhida, deixando a tela mais enxuta — clique para expandir quando precisar',
    ],
  },
  {
    id: '2026-07-20-foto-de-perfil',
    data: '2026-07-20',
    titulo: 'Agora dá para colocar uma foto de perfil',
    tipo: 'novidade',
    itens: [
      'Em Minha Conta, você já pode escolher uma foto para o seu perfil (JPEG, PNG ou WEBP, até 3 MB)',
      'A foto aparece no topo do sistema e no menu lateral — sem foto, continua mostrando as iniciais do seu nome',
    ],
  },
  {
    id: '2026-07-20-atendimento-envio-whatsapp-real',
    data: '2026-07-20',
    titulo: 'Mensagens do Atendimento agora chegam de verdade no WhatsApp',
    tipo: 'correcao',
    modulo: 'atendimento',
    itens: [
      'Ao iniciar uma conversa manualmente com um cliente, a mensagem agora é enviada de verdade pelo WhatsApp — antes ela só ficava salva no sistema, sem sair de fato',
      'Se o cliente não falou com você nas últimas 24 horas, o WhatsApp exige um modelo de mensagem aprovado para iniciar o contato — agora isso aparece como um aviso claro, em vez de um erro genérico',
    ],
  },
  {
    id: '2026-07-20-processos-audiencias-passadas-e-movimentacao-em-branco',
    data: '2026-07-20',
    titulo: 'Audiências já realizadas não aparecem mais pedindo para agendar',
    tipo: 'correcao',
    modulo: 'advocacia',
    itens: [
      'No card de audiências da tela do processo, só aparecem agora as que ainda vão acontecer — audiências antigas não mostram mais o botão "Agendar no calendário" (elas continuam no histórico de movimentações, só saíram desse card de ação)',
      'Corrigimos movimentações que chegavam do tribunal sem descrição (apareciam em branco na linha do tempo) — agora mostram uma indicação de qual movimentação é',
    ],
  },
  {
    id: '2026-07-18-atendimento-leila-topicos-horario-handoff',
    data: '2026-07-18',
    titulo: 'Mais controle sobre como a Leila atende: assuntos proibidos, horário e transferência automática',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Agora dá pra dizer quais assuntos a assistente de WhatsApp nunca deve comentar, além das regras padrão',
      'Você pode definir um horário de expediente — fora dele, ela avisa automaticamente em vez de tentar continuar a conversa sozinha',
      'Também dá pra cadastrar palavras que, quando o cliente escrever, transferem a conversa na hora para alguém da sua equipe',
      'Tudo isso fica em Configurações → Agente SDR, junto com o nome e o tom de voz que você já configura hoje',
    ],
  },
  {
    id: '2026-07-18-atendimento-leila-nao-esquece-reuniao',
    data: '2026-07-18',
    titulo: 'A Leila não "esquece" mais que já marcou a reunião',
    tipo: 'correcao',
    modulo: 'atendimento',
    itens: [
      'Corrigimos uma falha em que, depois de marcar a reunião de diagnóstico com o cliente, a assistente podia mandar a lista de horários disponíveis de novo na mensagem seguinte — como se nada tivesse sido agendado',
      'Agora, uma vez que a reunião está confirmada, ela não volta atrás: só responde com cordialidade a qualquer mensagem depois disso',
    ],
  },
  {
    id: '2026-07-17-atendimento-leila-ouve-audio',
    data: '2026-07-17',
    titulo: 'Leila agora ouve os áudios que os clientes mandam no WhatsApp',
    tipo: 'novidade',
    modulo: 'atendimento',
    itens: [
      'Antes, se o cliente mandasse uma mensagem de voz em vez de digitar, a assistente simplesmente não respondia — agora ela escuta o áudio e responde normalmente, como se a mensagem tivesse sido digitada',
      'Não precisa configurar nada: já funciona em qualquer conversa, do jeito que o cliente preferir mandar a mensagem',
    ],
  },
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
