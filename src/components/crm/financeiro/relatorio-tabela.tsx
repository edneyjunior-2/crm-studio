'use client'

import { Download } from 'lucide-react'
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
import type { RelatorioLinha } from '@/app/(crm)/financeiro/relatorio/page'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatDate(date: string) {
  const [y, m, d] = date.split('-')
  return new Date(+y, +m - 1, +d).toLocaleDateString('pt-BR')
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  recebido: 'Recebido',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  pendente: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  recebido: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  pago: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  atrasado: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  cancelado: 'bg-muted text-muted-foreground border-transparent',
}

interface RelatorioTabelaProps {
  linhas: RelatorioLinha[]
  filtros: {
    tipo: string
    status: string
    dataInicio: string
    dataFim: string
  }
}

export function RelatorioTabela({ linhas, filtros }: RelatorioTabelaProps) {
  const totalReceber = linhas
    .filter((l) => l.tipo === 'receber')
    .reduce((s, l) => s + l.valor, 0)

  const totalPagar = linhas
    .filter((l) => l.tipo === 'pagar')
    .reduce((s, l) => s + l.valor, 0)

  const totalGeral = totalReceber - totalPagar

  function exportarCSV() {
    const cabecalho = ['Tipo', 'Descrição', 'Fornecedor/Cliente', 'Categoria', 'Valor', 'Vencimento', 'Status']
    const linhasCSV = linhas.map((l) => [
      l.tipo === 'receber' ? 'A Receber' : 'A Pagar',
      `"${l.descricao.replace(/"/g, '""')}"`,
      `"${(l.fornecedor_cliente ?? '').replace(/"/g, '""')}"`,
      `"${(l.categoria ?? '').replace(/"/g, '""')}"`,
      l.valor.toFixed(2).replace('.', ','),
      formatDate(l.data_vencimento),
      STATUS_LABEL[l.status] ?? l.status,
    ])

    const csv = [cabecalho.join(';'), ...linhasCSV.map((r) => r.join(';'))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (linhas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Nenhum registro encontrado para os filtros selecionados.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Total de registros</span>
            <span className="text-sm font-semibold text-foreground">{linhas.length}</span>
          </div>
          {filtros.tipo !== 'pagar' && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Total a receber</span>
              <span className="text-sm font-semibold text-emerald-600 font-mono">{BRL(totalReceber)}</span>
            </div>
          )}
          {filtros.tipo !== 'receber' && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Total a pagar</span>
              <span className="text-sm font-semibold text-red-600 font-mono">{BRL(totalPagar)}</span>
            </div>
          )}
          {filtros.tipo === 'ambos' && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Saldo</span>
              <span className={`text-sm font-semibold font-mono ${totalGeral >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {BRL(totalGeral)}
              </span>
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={exportarCSV}>
          <Download className="size-3.5" />
          Exportar CSV
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor / Cliente</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={`${linha.tipo}-${linha.id}`}>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      linha.tipo === 'receber'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {linha.tipo === 'receber' ? 'Receber' : 'Pagar'}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{linha.descricao}</TableCell>
                <TableCell className="text-muted-foreground">
                  {linha.fornecedor_cliente ?? '—'}
                </TableCell>
                <TableCell>
                  {linha.categoria ? (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {linha.categoria}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {BRL(linha.valor)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(linha.data_vencimento)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={STATUS_CLASS[linha.status] ?? 'bg-muted text-muted-foreground'}
                  >
                    {STATUS_LABEL[linha.status] ?? linha.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
