import { z } from 'zod'

// Schema de linha de cliente importada via CSV
export const clienteImportadoSchema = z.object({
  razao_social: z.string().min(1, 'Razão Social obrigatória').max(255),
  cnpj: z.string().max(18).optional().nullable(),
  contato_nome: z.string().max(255).optional().nullable(),
  contato_email: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      'E-mail inválido'
    ),
  contato_telefone: z.string().max(30).optional().nullable(),
  segmento: z.string().max(255).optional().nullable(),
  observacoes: z.string().optional().nullable(),
})

export type ClienteImportadoInput = z.infer<typeof clienteImportadoSchema>

export const encarregadoSchema = z.object({
  encarregado_nome: z.string().max(255).optional().nullable(),
  encarregado_email: z
    .string()
    .email('E-mail do encarregado inválido')
    .max(255)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  encarregado_telefone: z.string().max(30).optional().nullable(),
})

export const contaPagarSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória').max(255),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  status: z.enum(['pendente', 'pago', 'atrasado', 'cancelado']).default('pendente'),
  categoria: z.string().optional().nullable(),
  fornecedor: z.string().optional().nullable(),
  fornecedor_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  moeda: z.string().default('BRL'),
  recorrente: z.coerce.boolean().default(false),
  frequencia: z
    .enum(['semanal', 'mensal', 'semestral', 'anual'])
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  is_cartao: z.coerce.boolean().default(false),
  num_parcelas: z.preprocess(
    (v) => (v === '' || v === null || v === undefined) ? undefined : v,
    z.coerce.number().int().min(2).max(48).optional()
  ),
  cartao_info: z.string().optional().nullable(),
  pix_copia_cola: z.string().optional().nullable(),
  codigo_boleto: z.string().optional().nullable(),
})

export const contaReceberSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória').max(255),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  status: z.enum(['pendente', 'recebido', 'atrasado', 'cancelado']).default('pendente'),
  negocio_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  cliente_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  moeda: z.string().default('BRL'),
})

export const negocioSchema = z.object({
  titulo: z.string().min(1, 'Título obrigatório').max(255),
  // Opcionais no schema: o Zod não sabe o tenant. A exigência de fato (quando
  // configurada em empresas.config.pipeline) é validada dinamicamente em
  // createNegocio/updateNegocio (src/app/(crm)/pipeline/actions.ts).
  cliente_id: z
    .string()
    .uuid('Cliente inválido')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  solucao_id: z
    .string()
    .uuid('Solução inválida')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  responsavel_id: z.string().uuid('Responsável obrigatório'),
  estagio: z.string().min(1, 'Selecione a etapa'),
  valor_estimado: z.coerce.number().min(0).optional().nullable(),
  probabilidade: z.coerce.number().int().min(0).max(100).optional().nullable(),
  data_previsao_fechamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  observacoes: z.string().optional().nullable(),
})
