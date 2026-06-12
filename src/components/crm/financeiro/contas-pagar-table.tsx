'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Receipt, CreditCard, CalendarRange, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ContaPagarForm } from './conta-pagar-form'
import { MarcarPagoDialog, type BancoComSaldo } from './marcar-pago-dialog'
import { deleteContaPagar } from '@/app/(crm)/financeiro/actions'
import type { ContaPagar } from '@/types'
import { formatMoeda } from '@/lib/moedas'

interface ContasPagarTableProps {
  contas: ContaPagar[]
  bancos: BancoComSaldo[]
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return new Date(+year, +month - 1, +day).toLocaleDateString('pt-BR')
}

function StatusBadge({ status }: { status: ContaPagar['status'] }) {
  const map: Record<ContaPagar['status'], { label: string; className: string }> = {
    pendente: {
      label: 'Pendente',
      className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
    },
    pago: {
      label: 'Pago',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    },
    atrasado: {
      label: 'Atrasado',
      className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
    },
    cancelado: {
      label: 'Cancelado',
      className: 'bg-muted text-muted-foreground border-transparent',
    },
  }

  const { label, className } = map[status]
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}


function mesAnoLabel(d: Date) {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function ContaRow({
  conta,
  bancos,
  onDelete,
  isPending,
}: {
  conta: ContaPagar
  bancos: BancoComSaldo[]
  onDelete: (id: string) => void
  isPending: boolean
}) {
  const editRef = useRef<HTMLButtonElement>(null)

  return (
    <TableRow
      className="cursor-pointer"
      onClick={(e) => {
        if (!e.isTrusted) return
        if ((e.target as HTMLElement).closest('[data-actions]')) return
        editRef.current?.click()
      }}
    >
      <TableCell className="font-medium">{conta.descricao}</TableCell>
      <TableCell className="text-muted-foreground">
        <div className="flex flex-col gap-0.5">
          <span>{conta.fornecedor ?? '—'}</span>
          {conta.is_cartao && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
              <CreditCard className="size-3" />
              {conta.cartao_info ?? 'Cartão'}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {conta.categoria ? (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {conta.categoria}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono font-medium">
            {formatMoeda(conta.valor, conta.moeda)}
          </span>
          {((conta.multa ?? 0) + (conta.juros ?? 0)) > 0 && (
            <span className="text-[11px] font-mono text-amber-600 leading-tight">
              Pago {formatMoeda(conta.valor_pago ?? conta.valor, conta.moeda)}
              {(conta.multa ?? 0) > 0 && ` · M ${formatMoeda(conta.multa!, conta.moeda)}`}
              {(conta.juros ?? 0) > 0 && ` · J ${formatMoeda(conta.juros!, conta.moeda)}`}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(conta.data_vencimento)}
      </TableCell>
      <TableCell>
        <StatusBadge status={conta.status} />
      </TableCell>
      <TableCell data-actions="">
        <div className="flex items-center justify-end gap-1">
          {conta.status !== 'pago' && conta.status !== 'cancelado' && (
            <MarcarPagoDialog conta={conta} bancos={bancos} />
          )}
          <ContaPagarForm
            conta={conta}
            trigger={
              <Button ref={editRef} variant="ghost" size="icon-sm">
                <Pencil className="size-3.5" />
                <span className="sr-only">Editar</span>
              </Button>
            }
          />
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                />
              }
            >
              <Trash2 className="size-3.5" />
              <span className="sr-only">Excluir</span>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir conta</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir{' '}
                  <strong>{conta.descricao}</strong>? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => onDelete(conta.id)}
                >
                  {isPending ? 'Excluindo...' : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  )
}

type FiltroStatus = ContaPagar['status'] | 'todos'

const FILTROS: { value: FiltroStatus; label: string }[] = [
  { value: 'todos',     label: 'Todos' },
  { value: 'pendente',  label: 'Pendente' },
  { value: 'atrasado',  label: 'Atrasado' },
  { value: 'pago',      label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
]

export function ContasPagarTable({ contas, bancos }: ContasPagarTableProps) {
  const [isPending, startTransition] = useTransition()
  const [verTudo, setVerTudo] = useState(false)
  const [proximosOpen, setProximosOpen] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')

  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()

  // Mais recentes primeiro (maior data de vencimento no topo)
  const sorted = [...contas].sort(
    (a, b) => new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime()
  )

  // Contagem por status para os badges dos filtros
  const contagens = sorted.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1
    return acc
  }, {})

  // Separar contas em aberto das encerradas
  const contasEmAberto = sorted.filter(
    (c) => c.status === 'pendente' || c.status === 'atrasado'
  )
  const contasPagas = sorted.filter(
    (c) => c.status === 'pago' || c.status === 'cancelado'
  )

  // Quando um filtro de status está ativo, mostra todos os itens daquele status (qualquer período)
  // Quando 'todos', respeita o filtro de período (mês atual ou tudo)
  const filtrado = filtroStatus !== 'todos'
    ? sorted.filter((c) => c.status === filtroStatus)
    : verTudo
      ? sorted
      : sorted.filter((c) => {
          const [y, m] = c.data_vencimento.split('-').map(Number)
          const inMonth = m - 1 === mesAtual && y === anoAtual
          return inMonth && (c.status === 'pendente' || c.status === 'atrasado')
        })

  // Contas em aberto no mês atual para o contador
  const contasAbertoMes = contasEmAberto.filter((c) => {
    const [y, m] = c.data_vencimento.split('-').map(Number)
    return m - 1 === mesAtual && y === anoAtual
  })
  const contasPagasMes = contasPagas.filter((c) => {
    const [y, m] = c.data_vencimento.split('-').map(Number)
    return m - 1 === mesAtual && y === anoAtual
  })

  // Próximos 30 dias — apenas pendentes
  const em30dias = new Date()
  em30dias.setDate(now.getDate() + 30)

  const proximosPagamentos = contas
    .filter((c) => {
      if (c.status !== 'pendente') return false
      const [y, m, d] = c.data_vencimento.split('-').map(Number)
      const venc = new Date(y, m - 1, d)
      return venc >= now && venc <= em30dias
    })
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteContaPagar(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Conta removida.')
    })
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-500/10">
          <Receipt className="size-7 text-red-600/60" />
        </div>
        <p className="text-base font-semibold text-foreground">
          Nenhuma conta a pagar registrada
        </p>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Clique em "Nova Conta" para registrar uma despesa prevista.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filtros de status */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => {
          const count = f.value === 'todos' ? sorted.length : (contagens[f.value] ?? 0)
          const ativo = filtroStatus === f.value
          const corAtrasado = f.value === 'atrasado' && count > 0
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltroStatus(f.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                ativo
                  ? corAtrasado
                    ? 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-400'
                    : 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
              )}
            >
              {f.label}
              <span className={cn(
                'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                ativo
                  ? corAtrasado ? 'bg-red-500/20 text-red-700' : 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}>
                {count}
              </span>
            </button>
          )
        })}

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setVerTudo((v) => !v); setFiltroStatus('todos') }}
            className="gap-1.5"
          >
            <CalendarRange className="size-3.5" />
            {verTudo ? 'Ver mês atual' : 'Ver tudo'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtroStatus !== 'todos'
          ? `${filtrado.length} conta${filtrado.length !== 1 ? 's' : ''} com status "${FILTROS.find(f => f.value === filtroStatus)?.label}"`
          : verTudo
            ? `${sorted.length} conta${sorted.length !== 1 ? 's' : ''} no total`
            : contasAbertoMes.length === 0
              ? 'Tudo em dia este mês'
              : `${contasAbertoMes.length} em aberto${contasPagasMes.length > 0 ? ` · ${contasPagasMes.length} paga${contasPagasMes.length !== 1 ? 's' : ''} este mês` : ''}`}
      </p>

      {filtrado.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-center">
          <Receipt className="mb-3 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {verTudo ? 'Nenhuma conta em aberto' : `Nenhuma conta em aberto em ${mesAnoLabel(now)}`}
          </p>
          {!verTudo && (
            <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => setVerTudo(true)}>
              Ver todas as contas
            </Button>
          )}
        </div>
      )}

      {filtrado.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrado.map((conta) => (
                <ContaRow
                  key={conta.id}
                  conta={conta}
                  bancos={bancos}
                  onDelete={handleDelete}
                  isPending={isPending}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Seção Próximos Pagamentos (30 dias) */}
      <div className="mt-1 rounded-xl border border-border bg-muted/30">
        <button
          onClick={() => setProximosOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <CalendarRange className="size-4 text-muted-foreground" />
            Próximos Pagamentos (30 dias)
            {proximosPagamentos.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {proximosPagamentos.length}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn('size-4 transition-transform', proximosOpen && 'rotate-180')}
          />
        </button>

        {proximosOpen && (
          <>
            {proximosPagamentos.length === 0 ? (
              <div className="border-t border-border px-4 py-5 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum pagamento nos próximos 30 dias
                </p>
              </div>
            ) : (
              proximosPagamentos.map((conta) => (
                <ContaPagarForm
                  key={conta.id}
                  conta={conta}
                  trigger={
                    <div className="flex cursor-pointer items-center justify-between border-t border-border px-4 py-2.5 text-sm transition-colors hover:bg-muted/50">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{conta.descricao}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(conta.data_vencimento)}
                          {conta.fornecedor ? ` · ${conta.fornecedor}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium">
                          {formatMoeda(conta.valor, conta.moeda)}
                        </span>
                        <StatusBadge status={conta.status} />
                      </div>
                    </div>
                  }
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
