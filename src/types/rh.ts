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

// ============================================================================
// Documentos de colaboradores (LGPD-by-design)
// ============================================================================

export type TipoDocumento =
  | 'rg'
  | 'cnh'
  | 'cpf'
  | 'aso'        // Atestado de Saúde Ocupacional — sensível por padrão
  | 'contrato'
  | 'ferias'
  | 'rescisao'
  | 'diploma'
  | 'outro'

export interface ColaboradorDocumento {
  id: string
  empresa_id: string
  colaborador_id: string
  tipo: TipoDocumento
  nome_original: string
  storage_path: string
  sensivel: boolean
  mime: string | null
  tamanho_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

export interface ColaboradorDocumentoAcesso {
  id: string
  empresa_id: string
  documento_id: string
  acao: 'upload' | 'download' | 'delete'
  user_id: string | null
  created_at: string
}

/** Tipos de documento considerados sensíveis por padrão (dado pessoal de saúde — Art. 11 LGPD) */
export const TIPOS_SENSIVEIS: TipoDocumento[] = ['aso']

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  rg: 'RG',
  cnh: 'CNH',
  cpf: 'CPF',
  aso: 'ASO (Saúde Ocupacional)',
  contrato: 'Contrato de trabalho',
  ferias: 'Aviso / Recibo de Férias',
  rescisao: 'Rescisão / TRCT',
  diploma: 'Diploma / Certificado',
  outro: 'Outro',
}
