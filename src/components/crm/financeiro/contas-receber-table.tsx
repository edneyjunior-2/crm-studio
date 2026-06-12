'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, CheckCircle, TrendingDown, CalendarRange, ChevronDown } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ContaReceberForm } from './conta-receber-form'
import { deleteContaReceber, marcarRecebido } from '@/app/(crm)/financeiro/actions'
import type { ContaReceber, Cliente, Negocio, Banco } from '@/types'
import { formatMoeda } from '@/lib/moedas'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type BancoComSaldo = Banco & { saldo: number }

interface ContaReceberComRelacoes extends ContaReceber {
  clientes: { razao_social: string } | null
}

interface ContasReceberTableProps {
  contas: ContaReceberComRelacoes[]
  clientes: Pick<Cliente, 'id' | 'razao_social'>[]
  negocios: Pick<Negocio, 'id' | 'titulo'>[]
  bancos: BancoComSaldo[]
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return new Date(+year, +month - 1, +day).toLocaleDateString('pt-BR')
}

function StatusBadge({ status }: { status: ContaReceber['status'] }) {
  const map: Record<ContaReceber['status'], { label: string; className: string }> = {
    pendente: {
      label: 'Pendente',
      className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
    },
    recebido: {
      label: 'Recebido',
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

function MarcarRecebidoDialog({ conta, bancos }: { conta: ContaReceberComRelacoes; bancos: BancoComSaldo[] }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const today = (() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()
  const [dataRecebimento, setDataRecebimento] = useState(today)
  const [bancoId, setBancoId] = useState<string | null>(bancos.length === 1 ? bancos[0].id : null)

  const bancoCurrent = bancos.find((b) => b.id === bancoId) ?? null
  const saldoApos = bancoCurrent ? bancoCurrent.saldo + Number(conta.valor) : null

  function handleConfirm() {
    startTransition(async () => {
      const result = await marcarRecebido(conta.id, dataRecebimento, bancoId ?? undefined)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Recebimento registrado.')
      setOpen(false)
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        <Button variant="ghost" size="icon-sm" className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600">
          <CheckCircle className="size-3.5" />
          <span className="sr-only">Marcar recebido</span>
        </Button>
      </span>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Confirme o recebimento de{' '}
              <strong className="text-foreground">{formatMoeda(conta.valor, conta.moeda)}</strong>
              {conta.clientes?.razao_social ? ` de ${conta.clientes.razao_social}` : ''}.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label>Conta bancária de crédito</Label>
              <Select value={bancoId ?? ''} onValueChange={(v) => setBancoId(v || null)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {bancos.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                      {b.instituicao ? ` — ${b.instituicao}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bancoCurrent && (
              <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Saldo atual</span>
                  <span className={`font-mono font-medium ${bancoCurrent.saldo >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                    {formatMoeda(bancoCurrent.saldo)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Após o recebimento</span>
                  <span className="font-mono font-medium text-emerald-600">
                    {formatMoeda(saldoApos ?? 0)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data_recebimento">Data de Recebimento</Label>
              <Input
                id="data_recebimento"
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button onClick={handleConfirm} disabled={isPending || !dataRecebimento}>
              {isPending ? 'Salvando...' : 'Confirmar recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function mesAnoLabel(d: Date) {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function ContasReceberTable({ contas, clientes, negocios, bancos }: ContasReceberTableProps) {
  const [isPending, startTransition] = useTransition()
  const [verTudo, setVerTudo] = useState(false)
  const [proximosOpen, setProximosOpen] = useState(true)

  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()

  const sorted = [...contas].sort(
    (a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
  )

  // Separar contas em aberto das encerradas
  const contasEmAberto = sorted.filter(
    (c) => c.status === 'pendente' || c.status === 'atrasado'
  )
  const contasRecebidas = sorted.filter(
    (c) => c.status === 'recebido' || c.status === 'cancelado'
  )

  // Filtro de período aplicado apenas sobre contas em aberto (ou todas quando verTudo)
  const filtradoBase = verTudo ? sorted : sorted.filter((c) => {
    const [y, m] = c.data_vencimento.split('-').map(Number)
    return m - 1 === mesAtual && y === anoAtual
  })

  const filtrado = verTudo
    ? filtradoBase
    : filtradoBase.filter((c) => c.status === 'pendente' || c.status === 'atrasado')

  // Contadores do mês atual para o texto dinâmico
  const contasAbertoMes = contasEmAberto.filter((c) => {
    const [y, m] = c.data_vencimento.split('-').map(Number)
    return m - 1 === mesAtual && y === anoAtual
  })
  const contasRecebidasMes = contasRecebidas.filter((c) => {
    const [y, m] = c.data_vencimento.split('-').map(Number)
    return m - 1 === mesAtual && y === anoAtual
  })

  // Próximos 30 dias — apenas pendentes
  const em30dias = new Date()
  em30dias.setDate(now.getDate() + 30)

  const proximosRecebimentos = contas
    .filter((c) => {
      if (c.status !== 'pendente') return false
      const [y, m, d] = c.data_vencimento.split('-').map(Number)
      const venc = new Date(y, m - 1, d)
      return venc >= now && venc <= em30dias
    })
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteContaReceber(id)
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
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10">
          <TrendingDown className="size-7 text-emerald-600/60" />
        </div>
        <p className="text-base font-semibold text-foreground">
          Nenhuma conta a receber registrada
        </p>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Clique em "Nova Conta" para registrar uma receita prevista.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {verTudo
            ? `${sorted.length} conta${sorted.length !== 1 ? 's' : ''} no total`
            : contasAbertoMes.length === 0 && contasRecebidasMes.length > 0
              ? 'Tudo recebido este mês'
              : contasAbertoMes.length > 0 && contasRecebidasMes.length === 0
                ? `${contasAbertoMes.length} em aberto`
                : contasAbertoMes.length > 0
                  ? `${contasAbertoMes.length} em aberto · ${contasRecebidasMes.length} recebida${contasRecebidasMes.length !== 1 ? 's' : ''} este mês`
                  : 'Nenhuma conta este mês'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setVerTudo((v) => !v)}
          className="gap-1.5"
        >
          <CalendarRange className="size-3.5" />
          {verTudo ? 'Ver mês atual' : 'Ver tudo'}
        </Button>
      </div>

      {filtrado.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-center">
          <TrendingDown className="mb-3 size-8 text-muted-foreground/30" />
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
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrado.map((conta) => (
                <TableRow key={conta.id}>
                  <TableCell className="font-medium">{conta.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {conta.clientes?.razao_social ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatMoeda(conta.valor, conta.moeda)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(conta.data_vencimento)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={conta.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {conta.status !== 'recebido' && conta.status !== 'cancelado' && (
                        <MarcarRecebidoDialog conta={conta} bancos={bancos} />
                      )}

                      <ContaReceberForm
                        conta={conta}
                        clientes={clientes}
                        negocios={negocios}
                        trigger={
                          <Button variant="ghost" size="icon-sm">
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
                              <strong>{conta.descricao}</strong>? Esta ação não pode ser
                              desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              disabled={isPending}
                              onClick={() => handleDelete(conta.id)}
                            >
                              {isPending ? 'Excluindo...' : 'Excluir'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Seção Próximos Recebimentos (30 dias) */}
      <div className="mt-1 rounded-xl border border-border bg-muted/30">
        <button
          onClick={() => setProximosOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <CalendarRange className="size-4 text-muted-foreground" />
            Próximos Recebimentos (30 dias)
            {proximosRecebimentos.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {proximosRecebimentos.length}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn('size-4 transition-transform', proximosOpen && 'rotate-180')}
          />
        </button>

        {proximosOpen && (
          <>
            {proximosRecebimentos.length === 0 ? (
              <div className="border-t border-border px-4 py-5 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum recebimento nos próximos 30 dias
                </p>
              </div>
            ) : (
              proximosRecebimentos.map((conta) => (
                <div
                  key={conta.id}
                  className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{conta.descricao}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(conta.data_vencimento)}
                      {conta.clientes?.razao_social ? ` · ${conta.clientes.razao_social}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">
                      {formatMoeda(conta.valor, conta.moeda)}
                    </span>
                    <StatusBadge status={conta.status} />
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
