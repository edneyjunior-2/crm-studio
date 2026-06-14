'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { salvarLancamentoFolha } from '@/app/(crm)/rh/actions'
import type { LancamentoFolha, Colaborador, FolhaStatus } from '@/types/rh'
import { FOLHA_STATUS_LABEL } from '@/types/rh'

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

function formatarCompetencia(competencia: string): string {
  // 'YYYY-MM' → 'MM/YYYY'
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}

function StatusBadge({ status }: { status: FolhaStatus }) {
  return (
    <Badge variant={status === 'pago' ? 'default' : 'secondary'}>
      {FOLHA_STATUS_LABEL[status]}
    </Badge>
  )
}

interface LancamentoFormDialogProps {
  colaboradores: Pick<Colaborador, 'id' | 'nome'>[]
  lancamentoExistente?: LancamentoFolha
  trigger: React.ReactNode
}

function LancamentoFormDialog({
  colaboradores,
  lancamentoExistente,
  trigger,
}: LancamentoFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [colaboradorId, setColaboradorId] = useState<string>(
    lancamentoExistente?.colaborador_id ?? ''
  )
  const [statusFolha, setStatusFolha] = useState<FolhaStatus>(
    lancamentoExistente?.status ?? 'aberto'
  )

  const colaboradorSelecionado = colaboradores.find((c) => c.id === colaboradorId)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('colaborador_id', colaboradorId)
    formData.set('status', statusFolha)

    startTransition(async () => {
      const result = await salvarLancamentoFolha(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Lançamento salvo.')
      setOpen(false)
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v) }}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lançamento de Folha</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-1">

              {/* Colaborador — UUID select com label manual (convenção Base UI) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lf_colaborador">
                  Colaborador <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={colaboradorId || undefined}
                  onValueChange={(v) => setColaboradorId(v ?? '')}
                >
                  <SelectTrigger id="lf_colaborador" className="w-full">
                    {colaboradorSelecionado ? (
                      <span className="flex flex-1 text-left line-clamp-1">
                        {colaboradorSelecionado.nome}
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecione o colaborador..." />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Competência */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="competencia">
                  Competência <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="competencia"
                  name="competencia"
                  type="month"
                  required
                  defaultValue={lancamentoExistente?.competencia ?? ''}
                />
                <p className="text-xs text-muted-foreground">Mês de referência da folha (YYYY-MM)</p>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="salario_base">Salário Base (R$)</Label>
                  <Input
                    id="salario_base"
                    name="salario_base"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={lancamentoExistente?.salario_base ?? '0'}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="beneficios">Benefícios (R$)</Label>
                  <Input
                    id="beneficios"
                    name="beneficios"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={lancamentoExistente?.beneficios ?? '0'}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="descontos">Descontos (R$)</Label>
                  <Input
                    id="descontos"
                    name="descontos"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={lancamentoExistente?.descontos ?? '0'}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lf_status">Status</Label>
                <Select
                  value={statusFolha}
                  onValueChange={(v) => setStatusFolha((v ?? 'aberto') as FolhaStatus)}
                >
                  <SelectTrigger id="lf_status" className="w-full">
                    <span className="flex flex-1 text-left">
                      {FOLHA_STATUS_LABEL[statusFolha]}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FOLHA_STATUS_LABEL) as FolhaStatus[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {FOLHA_STATUS_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending || !colaboradorId}>
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar lançamento'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface FolhaSimplesProps {
  lancamentos: LancamentoFolha[]
  colaboradores: Pick<Colaborador, 'id' | 'nome'>[]
}

export function FolhaSimples({ lancamentos, colaboradores }: FolhaSimplesProps) {
  const [competenciaFiltro, setCompetenciaFiltro] = useState<string>('')
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())

  // Agrupar lançamentos por competência
  const competencias = Array.from(new Set(lancamentos.map((l) => l.competencia))).sort(
    (a, b) => b.localeCompare(a)
  )

  const lancamentosFiltrados = competenciaFiltro
    ? lancamentos.filter((l) => l.competencia === competenciaFiltro)
    : lancamentos

  // Total por competência
  function totalCompetencia(comp: string) {
    return lancamentos
      .filter((l) => l.competencia === comp)
      .reduce((acc, l) => acc + (l.total ?? 0), 0)
  }

  function toggleExpand(comp: string) {
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(comp)) {
        next.delete(comp)
      } else {
        next.add(comp)
      }
      return next
    })
  }

  const competenciasParaExibir = competenciaFiltro ? [competenciaFiltro] : competencias

  if (lancamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/8">
          <DollarSign className="size-7 text-primary/60" />
        </div>
        <p className="text-base font-semibold text-foreground">Nenhum lançamento de folha</p>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Clique em &ldquo;Novo Lançamento&rdquo; para registrar a folha de pagamento.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro por competência */}
      <div className="flex items-center gap-3">
        <Label htmlFor="filtro_competencia" className="shrink-0 text-sm">
          Filtrar competência:
        </Label>
        <Select
          value={competenciaFiltro || undefined}
          onValueChange={(v) => setCompetenciaFiltro(v === '__todas__' || !v ? '' : v)}
        >
          <SelectTrigger id="filtro_competencia" className="w-48">
            {competenciaFiltro ? (
              <span className="flex flex-1 text-left">
                {formatarCompetencia(competenciaFiltro)}
              </span>
            ) : (
              <SelectValue placeholder="Todas as competências" />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas__">Todas as competências</SelectItem>
            {competencias.map((c) => (
              <SelectItem key={c} value={c}>
                {formatarCompetencia(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {competenciaFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCompetenciaFiltro('')}
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Grupos por competência */}
      <div className="flex flex-col gap-3">
        {competenciasParaExibir.map((comp) => {
          const itens = lancamentosFiltrados.filter((l) => l.competencia === comp)
          const isExpanded = expandidas.has(comp)

          return (
            <div key={comp} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header da competência */}
              <button
                type="button"
                onClick={() => toggleExpand(comp)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">
                    {formatarCompetencia(comp)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {itens.length} {itens.length === 1 ? 'colaborador' : 'colaboradores'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    Total: {brl(totalCompetencia(comp))}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Tabela detalhada */}
              {isExpanded && (
                <div className="border-t border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="text-right">Salário Base</TableHead>
                        <TableHead className="text-right">Benefícios</TableHead>
                        <TableHead className="text-right">Descontos</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20 text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((lancamento) => (
                        <TableRow key={lancamento.id}>
                          <TableCell className="font-medium">
                            {lancamento.colaborador?.nome ?? '—'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {brl(lancamento.salario_base)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {brl(lancamento.beneficios)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {brl(lancamento.descontos)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {brl(lancamento.total)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={lancamento.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <LancamentoFormDialog
                                colaboradores={colaboradores}
                                lancamentoExistente={lancamento}
                                trigger={
                                  <Button variant="ghost" size="sm">
                                    Editar
                                  </Button>
                                }
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { LancamentoFormDialog }
