'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Briefcase, HelpCircle, Trophy, Clock, CalendarCheck, RefreshCw } from 'lucide-react'
import { NegocioCard } from './negocio-card'
import { updateEstagioComData } from '@/app/(crm)/pipeline/actions'
import type { NegocioComRelacoes, EstagioNegocio, Cliente, Solucao } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Periodicidade } from '@/types'

const PERIODICIDADE_LABELS: Record<Periodicidade, string> = {
  unico: 'Contrato Único',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

function diasEntre(dataInicio: string, dataFim: string): number {
  const a = new Date(dataInicio)
  const b = new Date(dataFim)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const COLUNAS: {
  estagio: EstagioNegocio
  label: string
  headerClass: string
  borderClass: string
  dica: string
  quando: string
}[] = [
  {
    estagio: 'prospeccao',
    label: 'Prospecção',
    headerClass: 'text-sky-600',
    borderClass: 'border-sky-200',
    dica: 'Leads e oportunidades identificadas, mas ainda sem contato ou qualificação.',
    quando: 'Mova para Qualificação quando houver contato inicial confirmado e interesse demonstrado.',
  },
  {
    estagio: 'qualificacao',
    label: 'Qualificação',
    headerClass: 'text-violet-600',
    borderClass: 'border-violet-200',
    dica: 'O cliente tem interesse e o negócio foi avaliado como viável para seguir adiante.',
    quando: 'Mova para Proposta quando entender as necessidades e estiver pronto para apresentar valores.',
  },
  {
    estagio: 'proposta',
    label: 'Proposta',
    headerClass: 'text-amber-600',
    borderClass: 'border-amber-200',
    dica: 'Uma proposta comercial formal foi enviada ao cliente e aguarda resposta.',
    quando: 'Mova para Negociação quando o cliente estiver discutindo termos, condições ou preços.',
  },
  {
    estagio: 'negociacao',
    label: 'Negociação',
    headerClass: 'text-orange-600',
    borderClass: 'border-orange-200',
    dica: 'Estamos ajustando condições, valores ou escopo com o cliente para chegar a um acordo.',
    quando: 'Mova para Fechado Ganho ao assinar contrato, ou Fechado Perdido se não avançar.',
  },
  {
    estagio: 'fechado_ganho',
    label: 'Fechado Ganho',
    headerClass: 'text-emerald-700',
    borderClass: 'border-emerald-300',
    dica: 'Negócio concluído com sucesso — contrato assinado ou serviço contratado.',
    quando: 'Negócios chegam aqui após fechar contrato. Não há próxima etapa.',
  },
  {
    estagio: 'fechado_perdido',
    label: 'Perdido',
    headerClass: 'text-muted-foreground',
    borderClass: 'border-border',
    dica: 'O cliente optou por não contratar ou a oportunidade foi encerrada sem sucesso.',
    quando: 'Negócios chegam aqui quando a oportunidade é descartada por qualquer motivo.',
  },
]

function formatBRL(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

interface DropPendente {
  id: string
  targetEstagio: EstagioNegocio
  dataAtual: string | null
}

interface KanbanBoardProps {
  negocios: NegocioComRelacoes[]
  clientes: Pick<Cliente, 'id' | 'razao_social'>[]
  solucoes: Pick<Solucao, 'id' | 'nome'>[]
  googleConnected: boolean
}

export function KanbanBoard({ negocios: initialNegocios, clientes, solucoes, googleConnected }: KanbanBoardProps) {
  const [negocios, setNegocios] = useState<NegocioComRelacoes[]>(initialNegocios)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverEstagio, setDragOverEstagio] = useState<EstagioNegocio | null>(null)
  const [dropPendente, setDropPendente] = useState<DropPendente | null>(null)
  const [novaData, setNovaData] = useState('')
  const [periodicidade, setPeriodicidade] = useState<string>('mensal')
  const [dataFechamento, setDataFechamento] = useState('')
  const [motivoPerda, setMotivoPerda] = useState('')
  const [, startTransition] = useTransition()

  useEffect(() => {
    setNegocios(initialNegocios)
  }, [initialNegocios])

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, estagio: EstagioNegocio) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverEstagio(estagio)
  }

  function handleDragLeave() {
    setDragOverEstagio(null)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetEstagio: EstagioNegocio) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setDragOverEstagio(null)
    setDraggedId(null)

    const negocio = negocios.find((n) => n.id === id)
    if (!negocio || negocio.estagio === targetEstagio) return

    setNovaData(negocio.data_previsao_fechamento ?? '')
    setDataFechamento(todayISO())
    setPeriodicidade('mensal')
    setMotivoPerda('')
    setDropPendente({ id, targetEstagio, dataAtual: negocio.data_previsao_fechamento })
  }

  function handleConfirmarDrop() {
    if (!dropPendente) return
    const { id, targetEstagio } = dropPendente
    const isGanho = targetEstagio === 'fechado_ganho'

    const previous = [...negocios]
    setNegocios((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              estagio: targetEstagio,
              data_previsao_fechamento: novaData || n.data_previsao_fechamento,
              periodicidade: isGanho ? (periodicidade as Periodicidade) : n.periodicidade,
              data_fechamento: isGanho ? (dataFechamento || null) : n.data_fechamento,
            }
          : n
      )
    )
    setDropPendente(null)

    const isPerdido = targetEstagio === 'fechado_perdido'

    startTransition(async () => {
      const result = await updateEstagioComData(
        id,
        targetEstagio,
        novaData || null,
        isGanho ? periodicidade : null,
        isGanho ? (dataFechamento || null) : null,
        isPerdido ? (motivoPerda || null) : null
      )
      if (result.error) {
        toast.error(result.error)
        setNegocios(previous)
      } else if (isGanho) {
        toast.success('Negócio fechado com sucesso!')
      }
    })
  }

  function handleCancelarDrop() {
    setDropPendente(null)
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUNAS.map((coluna) => {
          const cards = negocios.filter((n) => n.estagio === coluna.estagio)
          const totalValor = cards.reduce((acc, n) => acc + (n.valor_estimado ?? 0), 0)
          const isDragOver = dragOverEstagio === coluna.estagio

          return (
            <div
              key={coluna.estagio}
              onDragOver={(e) => handleDragOver(e, coluna.estagio)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, coluna.estagio)}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors',
                coluna.borderClass,
                isDragOver && 'bg-muted/60 ring-2 ring-inset ring-muted-foreground/20'
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold', coluna.headerClass)}>
                    {coluna.label}
                  </span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {cards.length}
                  </span>
                  <div className="group/tip relative">
                    <button
                      type="button"
                      className="flex size-4 items-center justify-center rounded-full text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      aria-label={`Ajuda: ${coluna.label}`}
                    >
                      <HelpCircle className="size-3.5" />
                    </button>
                    <div className="pointer-events-none absolute left-0 top-6 z-50 w-56 rounded-lg border border-border bg-popover p-3 shadow-md opacity-0 transition-opacity group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto">
                      <p className="text-xs font-semibold text-foreground mb-1">{coluna.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{coluna.dica}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed border-t border-border pt-2">{coluna.quando}</p>
                    </div>
                  </div>
                </div>
                {cards.length > 0 && totalValor > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatBRL(totalValor)}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0">
                {cards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 py-10 text-center">
                    <Briefcase className="mb-2 size-7 text-muted-foreground/25" />
                    <p className="text-xs text-muted-foreground/50">Nenhum negócio nesta etapa</p>
                  </div>
                ) : (
                  cards.map((negocio) => (
                    <NegocioCard
                      key={negocio.id}
                      negocio={negocio}
                      clientes={clientes}
                      solucoes={solucoes}
                      onDragStart={handleDragStart}
                      googleConnected={googleConnected}
                    />
                  ))
                )}
                {isDragOver && draggedId && (
                  <div className="h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Popup padrão — atualizar prazo */}
      <Dialog
        open={!!dropPendente && dropPendente.targetEstagio !== 'fechado_ganho' && dropPendente.targetEstagio !== 'fechado_perdido'}
        onOpenChange={(v) => { if (!v) handleCancelarDrop() }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar Prazo de Fechamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ao mover para <strong>{COLUNAS.find(c => c.estagio === dropPendente?.targetEstagio)?.label}</strong>,
            deseja atualizar o prazo de fechamento?
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nova-data-prazo">Nova Data de Fechamento</Label>
            <Input
              id="nova-data-prazo"
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" onClick={handleCancelarDrop} />}>
              Cancelar
            </DialogClose>
            <Button onClick={handleConfirmarDrop}>
              Confirmar Mudança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Popup especial — Fechado Ganho com stats */}
      <Dialog
        open={!!dropPendente && dropPendente.targetEstagio === 'fechado_ganho'}
        onOpenChange={(v) => { if (!v) handleCancelarDrop() }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                <Trophy className="size-5 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-emerald-700">Negócio Fechado!</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Registre os detalhes do contrato</p>
              </div>
            </div>
          </DialogHeader>

          {/* Stats do negócio */}
          {dropPendente && (() => {
            const neg = negocios.find(n => n.id === dropPendente.id)
            if (!neg) return null
            const diasTotal = diasEntre(neg.created_at, todayISO())
            const prevOriginal = neg.data_previsao_original
            const prevAtual = neg.data_previsao_fechamento
            const atrasado = prevOriginal && prevAtual && prevOriginal !== prevAtual
            const BRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

            return (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Duração no Pipeline</p>
                    <p className="text-sm font-semibold text-foreground">{diasTotal} dias</p>
                  </div>
                </div>
                {neg.valor_estimado && (
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Valor do Contrato</p>
                      <p className="text-sm font-semibold text-foreground">{BRL(neg.valor_estimado)}</p>
                    </div>
                  </div>
                )}
                {prevOriginal && (
                  <div className="flex items-center gap-2 col-span-2">
                    <CalendarCheck className="size-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Previsão Original</p>
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        {prevOriginal.split('-').reverse().join('/')}
                        {atrasado && (
                          <span className="text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                            Prazo ajustado
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Data de fechamento real */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data-fechamento-real">Data de Fechamento Real</Label>
            <Input
              id="data-fechamento-real"
              type="date"
              value={dataFechamento}
              onChange={(e) => setDataFechamento(e.target.value)}
            />
          </div>

          {/* Periodicidade */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="size-3.5 text-muted-foreground" />
              <Label>Periodicidade do Contrato</Label>
            </div>
            <Select value={periodicidade} onValueChange={(v) => { if (v) setPeriodicidade(v) }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unico">Contrato Único (sem recorrência)</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="semestral">Semestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define com que frequência este cliente renova ou paga pelo serviço.
            </p>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" onClick={handleCancelarDrop} />}>
              Cancelar
            </DialogClose>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmarDrop}>
              Confirmar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Popup Perdido — registrar motivo */}
      <Dialog
        open={!!dropPendente && dropPendente.targetEstagio === 'fechado_perdido'}
        onOpenChange={(v) => { if (!v) handleCancelarDrop() }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Perda</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Descreva o motivo pelo qual este negócio não foi fechado. Isso ajuda a identificar padrões e melhorar os próximos processos.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motivo-perda">Por que perdemos este negócio?</Label>
            <textarea
              id="motivo-perda"
              value={motivoPerda}
              onChange={(e) => setMotivoPerda(e.target.value)}
              placeholder="Ex: Cliente escolheu concorrente por preço, projeto cancelado internamente, decisão adiada..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" onClick={handleCancelarDrop} />}>
              Cancelar
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmarDrop}>
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
