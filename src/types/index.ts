export type Role = 'admin' | 'socio' | 'comercial' | 'parceiro'

export interface Profile {
  id: string
  full_name: string
  role: Role
  cargo?: string | null
  created_at: string
  google_access_token?: string | null
  google_refresh_token?: string | null
  google_token_expiry?: string | null
  /** Path interno no Storage (bucket 'avatars'), não uma URL pública — resolver
   *  sempre via src/lib/avatar.ts (createSignedUrl). */
  avatar_path?: string | null
}

export interface Solucao {
  id: string
  nome: string
  empresa_representada: string
  descricao: string | null
  comissao_percentual: number | null
  ativo: boolean
  created_by: string
}

export interface Parceiro {
  id: string
  nome: string
  empresa: string | null
  contato_email: string | null
  contato_telefone: string | null
  contrato_assinado: boolean
  data_contrato: string | null
  observacoes: string | null
  created_by: string | null
  created_at: string
  contrato_url: string | null
  contrato_nome: string | null
  comissao_percentual: number | null
  cnpj: string | null
  cpf: string | null
  endereco: string | null
  tipo_pessoa: 'pf' | 'pj' | null
  responsavel_id: string | null
  responsavel?: { full_name: string } | null
}

export interface Cliente {
  id: string
  razao_social: string
  tipo_pessoa?: 'pj' | 'pf'
  cnpj: string | null
  cpf?: string | null
  bloqueio_exclusividade?: boolean
  contato_nome: string | null
  contato_email: string | null
  contato_telefone: string | null
  segmento: string | null
  observacoes: string | null
  created_by: string
  origem_tipo?: 'prospeccao_direta' | 'parceiro' | 'indicacao_interna' | null
  parceiro_id?: string | null
  indicado_por?: string | null
  area_tipo?: 'publica' | 'privada' | null
  responsavel_id?: string | null
  responsavel_desde?: string | null
  profiles?: { full_name: string } | null
}

export type EstagioNegocio =
  | 'prospeccao'
  | 'qualificacao'
  | 'proposta'
  | 'negociacao'
  | 'fechado_ganho'
  | 'fechado_perdido'

export type Periodicidade = 'unico' | 'mensal' | 'trimestral' | 'semestral' | 'anual'

export interface NegocioProduto {
  id: string
  negocio_id: string
  empresa_id: string
  solucao_id: string | null
  descricao: string | null
  valor: number
  ordem: number
}

export interface Negocio {
  id: string
  cliente_id: string
  solucao_id: string
  responsavel_id: string
  titulo: string
  estagio: EstagioNegocio
  valor_estimado: number | null
  probabilidade: number | null
  data_previsao_fechamento: string | null
  data_previsao_original: string | null
  periodicidade: Periodicidade | null
  data_fechamento: string | null
  motivo_perda?: string | null
  estagio_atualizado_em?: string | null
  origem?: string | null
  observacoes: string | null
  parceiro_id?: string | null
  indicado_por?: string | null
  created_at: string
  updated_at: string
}

export interface NegocioComRelacoes extends Negocio {
  clientes: { razao_social: string } | null
  solucoes: { nome: string } | null
  profiles: { full_name: string } | null
  parceiros?: { nome: string } | null
  indicador?: { full_name: string } | null
}

export interface Followup {
  id: string
  negocio_id: string
  responsavel_id: string
  tipo: 'd3' | 'd7'
  data_agendada: string
  status: 'pendente' | 'concluido' | 'cancelado'
  observacao: string | null
  created_by: string | null
  created_at: string
  negocios?: { titulo: string; clientes: { razao_social: string } | null } | null
}

export type Moeda = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'ARS'

export interface ContaReceber {
  id: string
  negocio_id: string | null
  cliente_id: string
  descricao: string
  valor: number
  moeda: Moeda
  data_vencimento: string
  data_recebimento: string | null
  status: 'pendente' | 'recebido' | 'atrasado' | 'cancelado'
  created_by: string
}

export interface ContaPagar {
  id: string
  descricao: string
  fornecedor: string | null
  valor: number
  moeda: Moeda
  data_vencimento: string
  data_pagamento: string | null
  categoria: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  recorrente: boolean
  frequencia: 'semanal' | 'mensal' | 'semestral' | 'anual' | null
  is_cartao: boolean
  cartao_info: string | null
  fornecedor_id: string | null
  valor_pago: number | null
  multa: number
  juros: number
  pix_copia_cola: string | null
  codigo_boleto: string | null
  comprovante_url: string | null
  created_by: string
  created_at?: string
}

export interface Fornecedor {
  id: string
  nome: string
  telefone: string | null
  pix_tipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null
  pix_chave: string | null
  created_by: string | null
  created_at: string
}

export interface Banco {
  id: string
  nome: string
  instituicao: string | null
  agencia: string | null
  conta: string | null
  tipo: 'corrente' | 'poupanca' | 'investimento' | 'caixa'
  saldo_inicial: number
  ativo: boolean
  pix_tipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null
  pix_chave: string | null
  created_by: string | null
  created_at: string
}

export interface Movimentacao {
  id: string
  banco_id: string
  tipo: 'entrada' | 'saida'
  valor: number
  moeda: Moeda
  descricao: string
  categoria: string | null
  destino_origem: string | null
  data: string
  conta_pagar_id: string | null
  conta_receber_id: string | null
  created_by: string | null
  created_at: string
}

export interface ComissaoComercial {
  id: string
  comercial_id: string
  negocio_id: string | null
  descricao: string
  valor: number
  data_previsao: string
  data_pagamento: string | null
  status: 'previsto' | 'pago' | 'cancelado'
  observacoes: string | null
  created_by: string | null
  created_at: string
}

export interface ComissaoComRelacoes extends ComissaoComercial {
  profiles: { full_name: string } | null
  negocios: { titulo: string } | null
  parceiros_comissao?: { nome: string } | null
}

export interface ParceiroComissao {
  id: string
  nome: string
  cnpj: string | null
  contato_nome: string | null
  contato_email: string | null
  contato_telefone: string | null
  pix_tipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null
  pix_chave: string | null
  banco_nome: string | null
  banco_agencia: string | null
  banco_conta: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
}

export interface Fluxo {
  id: string
  titulo: string
  descricao: string | null
  owner_id: string
  visibilidade: 'privado' | 'todos_comerciais'
  created_at: string
  updated_at: string
  owner?: { full_name: string }
  colunas?: FluxoColuna[]
}

export interface FluxoColuna {
  id: string
  fluxo_id: string
  titulo: string
  cor: string
  ordem: number
  cards?: FluxoCard[]
}

export interface FluxoCard {
  id: string
  fluxo_id: string
  coluna_id: string
  titulo: string
  descricao: string | null
  responsavel_id: string | null
  ordem: number
  responsavel?: { full_name: string }
  // Campos Onboarding (AC2)
  cliente_id: string | null
  data_limite: string | null
  concluido: boolean
  cliente?: { razao_social: string } | null
}

export interface AgendaBloqueio {
  id: string
  user_id: string
  titulo: string
  descricao: string | null
  data: string
  hora_inicio: string
  hora_fim: string
  created_at: string
}
