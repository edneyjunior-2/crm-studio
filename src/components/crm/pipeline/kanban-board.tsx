'use client'

import Link from 'next/link'
import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Briefcase, HelpCircle, Trophy, Clock, CalendarCheck, RefreshCw } from 'lucide-react'
import { NegocioCard } from './negocio-card'
import { updateEstagioComData } from '@/app/(crm)/pipeline/actions'
import { gerarFinanceiroDoFechamento } from '@/app/(crm)/pipeline/fechamento-financeiro-actions'
import type { NegocioComRelacoes, Cliente, Solucao, Parceiro, Profile } from '@/types'
import type { EstagioPipeline } from '@/lib/pipeline-estagios'
import { PIPELINE_CONFIG_DEFAULT, type PipelineConfig } from '@/lib/pipeline-config'
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

// ponytail: `desqualificado` ainda não está em NegocioComRelacoes (src/types,
// fora da lane deste stream) — alias local só p/ este arquivo compilar.
type NegocioComDesq = NegocioComRelacoes & { desqualificado?: boolean | null }

const PERIODICIDADE_LABELS: Record<Periodicidade, string> = {
  unico: 'Contrato Único',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

/** Classe de cor do cabeçalho da coluna baseada no tipo da etapa. */
function headerClassForTipo(tipo: EstagioPipeline['tipo'], cor: string | null): string {
  if (cor) return '' // cor customizada via style inline
  if (tipo === 'ganho') return 'text-emerald-700'
  if (tipo === 'perdido') return 'text-muted-foreground'
  return 'text-sky-600'
}

/** Classe de borda baseada no tipo. */
function borderClassForTipo(tipo: EstagioPipeline['tipo']): string {
  if (tipo === 'ganho') return 'border-emerald-300'
  if (tipo === 'perdido') return 'border-border'
  return 'border-border/60'
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

function primeiroDiaMes(offsetMeses: number): string {
  const d = new Date()
  const totalMeses = d.getMonth() + offsetMeses
  const ano = d.getFullYear() + Math.floor(totalMeses / 12)
  const mes = ((totalMeses % 12) + 12) % 12
  return `${ano}-${String(mes + 1).padStart(2, '0')}-01`
}

function formatBRL(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

interface DropPendente {
  id: string
  targetSlug: string
  targetTipo: EstagioPipeline['tipo']
  targetLabel: string
  dataAtual: string | null
}

interface KanbanBoardProps {
  negocios: NegocioComDesq[]
  clientes: Pick<Cliente, 'id' | 'razao_social'>[]
  solucoes: Pick<Solucao, 'id' | 'nome'>[]
  googleConnected: boolean
  estagios: EstagioPipeline[]
  parceiros?: Pick<Parceiro, 'id' | 'nome'>[]
  membrosTime?: Pick<Profile, 'id' | 'full_name'>[]
  pipelineConfig?: PipelineConfig
}

export function KanbanBoard({ negocios: initialNegocios, clientes, solucoes, googleConnected, estagios, parceiros = [], membrosTime = [], pipelineConfig = PIPELINE_CONFIG_DEFAULT }: KanbanBoardProps) {
  const [negocios, setNegocios] = useState<NegocioComDesq[]>(initialNegocios)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverSlug, setDragOverSlug] = useState<string | null>(null)
  const [dropPendente, setDropPendente] = useState<DropPendente | null>(null)
  const [novaData, setNovaData] = useState('')
  const [periodicidade, setPeriodicidade] = useState<string>('mensal')
  const [dataFechamento, setDataFechamento] = useState('')
  const [motivoPerda, setMotivoPerda] = useState('')
  const [gerarFinanceiro, setGerarFinanceiro] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setNegocios(initialNegocios)
  }, [initialNegocios])

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, slug: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverSlug(slug)
  }

  function handleDragLeave() {
    setDragOverSlug(null)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, estagio: EstagioPipeline) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setDragOverSlug(null)
    setDraggedId(null)

    const negocio = negocios.find((n) => n.id === id)
    if (!negocio || negocio.estagio === estagio.slug) return

    setNovaData(negocio.data_previsao_fechamento ?? '')
    setDataFechamento(todayISO())
    setPeriodicidade('mensal')
    setMotivoPerda('')
    setGerarFinanceiro(true)
    setDropPendente({
      id,
      targetSlug: estagio.slug,
      targetTipo: estagio.tipo,
      targetLabel: estagio.nome,
      dataAtual: negocio.data_previsao_fechamento,
    })
  }

  function handleConfirmarDrop() {
    if (!dropPendente) return
    const { id, targetSlug, targetTipo } = dropPendente
    const isGanho = targetTipo === 'ganho'
    const isPerdido = targetTipo === 'perdido'

    const previous = [...negocios]
    setNegocios((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              estagio: targetSlug as NegocioComRelacoes['estagio'],
              data_previsao_fechamento: novaData || n.data_previsao_fechamento,
              periodicidade: isGanho ? (periodicidade as Periodicidade) : n.periodicidade,
              data_fechamento: (isGanho || isPerdido) ? (dataFechamento || null) : null,
            }
          : n
      )
    )
    setDropPendente(null)

    const deveGerarFinanceiro = isGanho && gerarFinanceiro

    startTransition(async () => {
      const result = await updateEstagioComData(
        id,
        targetSlug,
        novaData || null,
        isGanho ? periodicidade : null,
        (isGanho || isPerdido) ? (dataFechamento || null) : null,
        isPerdido ? (motivoPerda || null) : null
      )
      if (result.error) {
        toast.error(result.error)
        setNegocios(previous)
        return
      }

      // Só gera financeiro se ESTE request foi quem de fato moveu o negócio p/
      // ganho (result.transicionou). Fechamentos concorrentes do mesmo negócio
      // não duplicam conta/comissão.
      if (deveGerarFinanceiro && result.transicionou !== false) {
        const dataBase = dataFechamento || todayISO()
        const finResult = await gerarFinanceiroDoFechamento({
          negocioId: id,
          dataFechamento: dataBase,
          periodicidade,
        })
        if (finResult.error) {
          toast.success('Negócio fechado com sucesso!')
          toast.error(`Financeiro: ${finResult.error}`)
        } else {
          toast.success(`Negócio fechado! ${finResult.mensagem}`)
        }
      } else if (isGanho) {
        toast.success('Negócio fechado com sucesso!')
      }
    })
  }

  function handleCancelarDrop() {
    setDropPendente(null)
  }

  function handleMoverPara(negocio: NegocioComRelacoes, targetSlug: string) {
    if (negocio.estagio === targetSlug) return

    const estagio = estagios.find((e) => e.slug === targetSlug)
    const tipo = estagio?.tipo ?? 'aberto'

    if (tipo === 'ganho' || tipo === 'perdido') {
      // Abre o dialog de confirmação (ganho ou perdido)
      setNovaData(negocio.data_previsao_fechamento ?? '')
      setDataFechamento(todayISO())
      setPeriodicidade('mensal')
      setMotivoPerda('')
      setGerarFinanceiro(true)
      setDropPendente({
        id: negocio.id,
        targetSlug,
        targetTipo: tipo,
        targetLabel: estagio?.nome ?? targetSlug,
        dataAtual: negocio.data_previsao_fechamento,
      })
    } else {
      // Move direto sem dialog
      const previous = [...negocios]
      setNegocios((prev) =>
        prev.map((n) =>
          n.id === negocio.id ? { ...n, estagio: targetSlug as NegocioComRelacoes['estagio'] } : n
        )
      )
      startTransition(async () => {
        const result = await updateEstagioComData(negocio.id, targetSlug, null)
        if (result.error) {
          toast.error(result.error)
          setNegocios(previous)
        }
      })
    }
  }

  // Determina tipo do drop pendente para controlar qual dialog abrir
  const dropTipo = dropPendente?.targetTipo ?? null

  // Defesa em profundidade: o fetch do board já filtra desqualificado=false,
  // mas um negócio desqualificado nunca deve aparecer numa coluna mesmo se
  // chegar via estado otimista (ex.: update de outro fluxo antes do refresh).
  const negociosVisiveis = negocios.filter((n) => !n.desqualificado)

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {estagios.map((estagio) => {
          const cards = negociosVisiveis.filter((n) => n.estagio === estagio.slug)
          const totalValor = cards.reduce((acc, n) => acc + (n.valor_estimado ?? 0), 0)
          const isDragOver = dragOverSlug === estagio.slug
          const headerClass = headerClassForTipo(estagio.tipo, estagio.cor)
          const borderClass = borderClassForTipo(estagio.tipo)

          return (
            <div
              key={estagio.slug}
              onDragOver={(e) => handleDragOver(e, estagio.slug)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, estagio)}
              className={cn(
                'flex w-80 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors',
                borderClass,
                isDragOver && 'bg-muted/60 ring-2 ring-inset ring-muted-foreground/20'
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn('text-sm font-semibold', headerClass)}
                    style={estagio.cor ? { color: estagio.cor } : undefined}
                  >
                    {estagio.nome}
                  </span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {cards.length}
                  </span>
                  <div className="group/tip relative">
                    <button
                      type="button"
                      className="flex size-4 items-center justify-center rounded-full text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      aria-label={`Ajuda: ${estagio.nome}`}
                    >
                      <HelpCircle className="size-3.5" />
                    </button>
                    <div className="pointer-events-none absolute left-0 top-6 z-50 w-56 rounded-lg border border-border bg-popover p-3 shadow-md opacity-0 transition-opacity group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto">
                      <p className="text-xs font-semibold text-foreground mb-1">{estagio.nome}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {estagio.tipo === 'ganho'
                          ? 'Negócio concluído com sucesso — contrato assinado ou serviço contratado.'
                          : estagio.tipo === 'perdido'
                          ? 'O cliente optou por não contratar ou a oportunidade foi encerrada.'
                          : `Etapa "${estagio.nome}" do funil de vendas.`}
                      </p>
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
                    {estagio.tipo === 'ganho' || estagio.tipo === 'perdido' ? (
                      <>
                        <p className="text-xs text-muted-foreground/50">Nada fechado este mês</p>
                        <Link
                          href="/pipeline/historico-perdidos"
                          className="mt-1 text-xs font-medium text-muted-foreground/70 underline-offset-2 hover:underline"
                        >
                          Ver histórico →
                        </Link>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground/50">Nenhum negócio nesta etapa</p>
                    )}
                  </div>
                ) : (
                  cards.map((negocio) => (
                    <NegocioCard
                      key={negocio.id}
                      negocio={negocio}
                      clientes={clientes}
                      solucoes={solucoes}
                      estagios={estagios}
                      onDragStart={handleDragStart}
                      googleConnected={googleConnected}
                      onMoverPara={(targetSlug) => handleMoverPara(negocio, targetSlug)}
                      parceiros={parceiros}
                      membrosTime={membrosTime}
                      pipelineConfig={pipelineConfig}
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

      {/* Popup padrão — etapa tipo 'aberto': só atualiza prazo */}
      <Dialog
        open={!!dropPendente && dropTipo === 'aberto'}
        onOpenChange={(v) => { if (!v) handleCancelarDrop() }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar Prazo de Fechamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ao mover para <strong>{dropPendente?.targetLabel}</strong>,
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
            <Button onClick={handleConfirmarDrop} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Confirmar Mudança'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Popup especial — etapa tipo 'ganho': Negócio Fechado! + financeiro */}
      <Dialog
        open={!!dropPendente && dropTipo === 'ganho'}
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
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDataFechamento(primeiroDiaMes(0))}
              >
                Mês vigente
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDataFechamento(primeiroDiaMes(1))}
              >
                Próximo mês
              </Button>
            </div>
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

          {/* Gerar financeiro automaticamente */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 hover:bg-emerald-50 transition-colors">
            <input
              type="checkbox"
              checked={gerarFinanceiro}
              onChange={(e) => setGerarFinanceiro(e.target.checked)}
              className="mt-0.5 size-4 accent-emerald-600 cursor-pointer"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">Gerar conta a receber e comissão</span>
              <span className="text-xs text-muted-foreground">
                Cria automaticamente a conta a receber no financeiro e a comissão prevista para o responsável pelo negócio.
              </span>
            </div>
          </label>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" onClick={handleCancelarDrop} />}>
              Cancelar
            </DialogClose>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmarDrop} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Confirmar Fechamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Popup Perdido — etapa tipo 'perdido': registrar motivo */}
      <Dialog
        open={!!dropPendente && dropTipo === 'perdido'}
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
            <Button variant="destructive" onClick={handleConfirmarDrop} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Confirmar Perda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
