import { z } from 'zod'

export const produtoSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(255),
  sku: z.string().max(100).optional().nullable().or(z.literal('')).transform((v) => v || null),
  unidade: z.string().min(1).max(20).default('un'),
  custo_medio: z.coerce.number().min(0).default(0),
  preco_venda: z.coerce.number().min(0).default(0),
  estoque_minimo: z.coerce.number().min(0).default(0),
  ativo: z.coerce.boolean().default(true),
})

export type ProdutoInput = z.infer<typeof produtoSchema>

export const movimentacaoEstoqueSchema = z
  .object({
    produto_id: z.string().uuid('Produto obrigatório'),
    tipo: z.enum(['entrada', 'saida', 'ajuste']),
    // Ajuste pode ser negativo (reduz saldo); entrada/saida só positivo. Nunca zero.
    quantidade: z.coerce
      .number()
      .min(-9_999_999, 'Quantidade muito baixa')
      .max(9_999_999, 'Quantidade muito alta'),
    custo_unitario: z.coerce
      .number()
      .min(0)
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((v) => (v === '' || v == null ? null : Number(v))),
    motivo: z.string().max(500).optional().nullable().or(z.literal('')).transform((v) => v || null),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  })
  .superRefine((data, ctx) => {
    if (data.quantidade === 0) {
      ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'Quantidade não pode ser zero' })
    } else if (data.tipo !== 'ajuste' && data.quantidade < 0) {
      ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'Quantidade deve ser positiva' })
    }
  })

export type MovimentacaoEstoqueInput = z.infer<typeof movimentacaoEstoqueSchema>
