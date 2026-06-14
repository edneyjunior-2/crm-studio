import { z } from 'zod'

export const colaboradorSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(255),
  cpf: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  cargo: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  departamento: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  email: z
    .string()
    .email('E-mail inválido')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  telefone: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  data_admissao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  data_desligamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  status: z.enum(['ativo', 'afastado', 'desligado']).default('ativo'),
  tipo_contrato: z
    .enum(['clt', 'pj', 'estagio', 'outro'])
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  salario: z.coerce
    .number()
    .min(0, 'Salário não pode ser negativo')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
})

export const ausenciaSchema = z.object({
  colaborador_id: z.string().uuid('Colaborador obrigatório'),
  tipo: z.enum(['ferias', 'atestado', 'falta', 'licenca']),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início obrigatória'),
  data_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  observacao: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
})

export const lancamentoFolhaSchema = z.object({
  colaborador_id: z.string().uuid('Colaborador obrigatório'),
  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Competência deve estar no formato 'YYYY-MM'"),
  salario_base: z.coerce.number().min(0, 'Salário base não pode ser negativo').default(0),
  beneficios: z.coerce.number().min(0).optional().nullable().default(0),
  descontos: z.coerce.number().min(0).optional().nullable().default(0),
  status: z.enum(['aberto', 'pago']).default('aberto'),
})

// ============================================================================
// Documentos de colaboradores
// ============================================================================

const TIPOS_DOCUMENTO = [
  'rg', 'cnh', 'cpf', 'aso', 'contrato', 'ferias', 'rescisao', 'diploma', 'outro',
] as const

export const uploadDocumentoSchema = z.object({
  colaborador_id: z.string().uuid('Colaborador obrigatório'),
  tipo: z.enum(TIPOS_DOCUMENTO, 'Tipo obrigatório'),
  sensivel: z.boolean().optional().default(false),
})
