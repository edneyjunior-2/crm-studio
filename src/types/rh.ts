// ============================================================================
// Módulo RH — tipos TypeScript
// ============================================================================

export type ColaboradorStatus = 'ativo' | 'afastado' | 'desligado'
export type TipoContrato = 'clt' | 'pj' | 'estagio' | 'outro'
export type TipoAusencia = 'ferias' | 'atestado' | 'falta' | 'licenca'
export type FolhaStatus = 'aberto' | 'pago'

export interface Colaborador {
  id: string
  empresa_id: string
  nome: string
  cpf: string | null
  cargo: string | null
  departamento: string | null
  email: string | null
  telefone: string | null
  data_admissao: string | null  // 'YYYY-MM-DD'
  data_desligamento: string | null  // 'YYYY-MM-DD'
  status: ColaboradorStatus
  tipo_contrato: TipoContrato | null
  salario: number | null
  created_by: string | null
  created_at: string
}

export interface Ausencia {
  id: string
  empresa_id: string
  colaborador_id: string
  tipo: TipoAusencia
  data_inicio: string  // 'YYYY-MM-DD'
  data_fim: string | null  // 'YYYY-MM-DD'
  observacao: string | null
  created_by: string | null
  created_at: string
  colaborador?: Pick<Colaborador, 'id' | 'nome'> | null
}

export interface LancamentoFolha {
  id: string
  empresa_id: string
  colaborador_id: string
  competencia: string  // 'YYYY-MM'
  salario_base: number
  beneficios: number | null
  descontos: number | null
  total: number | null
  status: FolhaStatus
  created_by: string | null
  created_at: string
  colaborador?: Pick<Colaborador, 'id' | 'nome' | 'cargo'> | null
}

// Labels para exibição em PT-BR
export const COLABORADOR_STATUS_LABEL: Record<ColaboradorStatus, string> = {
  ativo: 'Ativo',
  afastado: 'Afastado',
  desligado: 'Desligado',
}

export const TIPO_CONTRATO_LABEL: Record<TipoContrato, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  outro: 'Outro',
}

export const TIPO_AUSENCIA_LABEL: Record<TipoAusencia, string> = {
  ferias: 'Férias',
  atestado: 'Atestado',
  falta: 'Falta',
  licenca: 'Licença',
}

export const FOLHA_STATUS_LABEL: Record<FolhaStatus, string> = {
  aberto: 'Em aberto',
  pago: 'Pago',
}
