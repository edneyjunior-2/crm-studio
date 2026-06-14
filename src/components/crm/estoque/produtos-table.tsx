'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, AlertTriangle, ArrowRightLeft, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProdutoForm } from './produto-form'
import { MovimentacaoForm } from './movimentacao-form'
import { deleteProduto } from '@/app/(crm)/estoque/actions'
import type { Produto } from '@/types/estoque'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface ProdutosTableProps {
  produtos: Produto[]
}

export function ProdutosTable({ produtos }: ProdutosTableProps) {
  const [isPendingDelete, startDelete] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir o produto "${nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletingId(id)
    startDelete(async () => {
      const result = await deleteProduto(id)
      setDeletingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Produto excluído.')
      }
    })
  }

  if (produtos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Package className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Nenhum produto cadastrado</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cadastre o primeiro produto para começar a controlar o estoque.
          </p>
        </div>
      </div>
    )
  }

  const produtosParaMovimentacao = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    unidade: p.unidade,
    saldo_atual: p.saldo_atual,
  }))

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Saldo atual</TableHead>
            <TableHead className="text-right">Mínimo</TableHead>
            <TableHead className="text-right">Custo médio</TableHead>
            <TableHead className="text-right">Preço venda</TableHead>
            <TableHead className="text-right">Valor em estoque</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produtos.map((produto) => {
            const abaixoMinimo =
              produto.estoque_minimo > 0 && produto.saldo_atual < produto.estoque_minimo
            const valorEstoque = produto.saldo_atual * produto.custo_medio

            return (
              <TableRow key={produto.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {abaixoMinimo && (
                      <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                    )}
                    <span className="font-medium text-foreground">{produto.nome}</span>
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {produto.sku ?? '—'}
                </TableCell>

                <TableCell className="text-right">
                  <span
                    className={
                      abaixoMinimo
                        ? 'font-semibold text-red-600'
                        : 'font-semibold text-foreground'
                    }
                  >
                    {produto.saldo_atual} {produto.unidade}
                  </span>
                </TableCell>

                <TableCell className="text-right text-muted-foreground">
                  {produto.estoque_minimo > 0
                    ? `${produto.estoque_minimo} ${produto.unidade}`
                    : '—'}
                </TableCell>

                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {BRL(produto.custo_medio)}
                </TableCell>

                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {BRL(produto.preco_venda)}
                </TableCell>

                <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                  {BRL(valorEstoque)}
                </TableCell>

                <TableCell>
                  {produto.ativo ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inativo
                    </Badge>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {/* Registrar movimentação rápida */}
                    <MovimentacaoForm
                      produtos={produtosParaMovimentacao}
                      produtoIdInicial={produto.id}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Registrar movimentação"
                        >
                          <ArrowRightLeft className="size-3.5" />
                          <span className="sr-only">Movimentação</span>
                        </Button>
                      }
                    />

                    {/* Editar produto */}
                    <ProdutoForm
                      produto={produto}
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Editar produto">
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>
                      }
                    />

                    {/* Excluir produto */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Excluir produto"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={isPendingDelete && deletingId === produto.id}
                      onClick={() => handleDelete(produto.id, produto.nome)}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Excluir</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
