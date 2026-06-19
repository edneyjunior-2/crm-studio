'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2, User, Calendar, Pencil, Mail, AlertTriangle, Clock, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { deleteNegocio, updateNegocio, updateEstagioComData } from '@/app/(crm)/pipeline/actions'
import { registrarEmailComFollowups } from '@/app/(crm)/pipeline/followup-actions'
import { RegistrarReuniaoDialog } from './registrar-reuniao-dialog'
import type { NegocioComRelacoes, EstagioNegocio, Cliente, Solucao, Periodicidade } from '@/types'

// SLA padrão por estágio (em dias)
const SLA_DIAS: Partial<Record<EstagioNegocio, number>> = {
  prospeccao: 14,
  qualificacao: 10,
  proposta: 7,
  negociacao: 5,
}

// Opções de motivo de perda
const MOTIVOS_PERDA = [
  'Preço acima do orçamento',
  'Escolheu concorrente',
  'Projeto cancelado',
  'Sem resposta do cliente',
  'Timing — não é o momento',
  'Outro',
]

function calcularDiasParado(negocio: NegocioComRelacoes): number {
  const ref = negocio.estagio_atualizado_em ?? negocio.updated_at
  if (!ref) return 0
  const inicio = new Date(ref)
  const agora = new Date()
  return Math.floor((agora.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
}

interface SlaBadgeProps {
  negocio: NegocioComRelacoes
}

function SlaBadge({ negocio }: SlaBadgeProps) {
  const sla = SLA_DIAS[negocio.estagio]
  if (!sla) return null

  const dias = calcularDiasParado(negocio)
  if (dias <= 0) return null

  const percentual = dias / sla

  if (percentual >= 1) {
    // Passou o SLA — badge vermelho
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        <AlertTriangle className="size-2.5 shrink-0" />
        {dias} dias parado
      </span>
    )
  }

  if (percentual >= 0.75) {
    // Chegando no limite — badge amarelo
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
        <Clock className="size-2.5 shrink-0" />
        {dias} dias
      </span>
    )
  }

  return null
}

const PERIODICIDADE_LABELS: Record<Periodicidade, string> = {
  unico: 'Contrato Único',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

const ESTAGIOS: { value: EstagioNegocio; label: string }[] = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'fechado_ganho', label: 'Fechado Ganho' },
  { value: 'fechado_perdido', label: 'Perdido' },
]

function formatBRL(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return new Date(+year, +month - 1, +day).toLocaleDateString('pt-BR')
}

function getProbabilidadeVariant(prob: number): 'default' | 'secondary' | 'outline' {
  if (prob >= 70) return 'default'
  if (prob >= 40) return 'secondary'
  return 'outline'
}

interface NegocioCardProps {
  negocio: NegocioComRelacoes
  clientes: Pick<Cliente, 'id' | 'razao_social'>[]
  solucoes: Pick<Solucao, 'id' | 'nome'>[]
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void
  googleConnected: boolean
}

export function NegocioCard({ negocio, clientes, solucoes, onDragStart, googleConnected }: NegocioCardProps) {
  const [deleteIsPending, startDeleteTransition] = useTransition()
  const [editIsPending, startEditTransition] = useTransition()
  const [emailIsPending, startEmailTransition] = useTransition()
  const [perdaIsPending, startPerdaTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [reuniaoOpen, setReuniaoOpen] = useState(false)
  const [perdaOpen, setPerdaOpen] = useState(false)
  const [estagio, setEstagio] = useState<EstagioNegocio>(negocio.estagio)
  const [clienteId, setClienteId] = useState<string | null>(negocio.cliente_id)
  const [solucaoId, setSolucaoId] = useState<string | null>(negocio.solucao_id)
  const [emailObs, setEmailObs] = useState('')
  const [agendarD3, setAgendarD3] = useState(true)
  const [agendarD7, setAgendarD7] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [motivoOutro, setMotivoOutro] = useState('')

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteNegocio(negocio.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Negócio excluído com sucesso.')
    })
  }

  function handleRegistrarEmail() {
    startEmailTransition(async () => {
      const result = await registrarEmailComFollowups(
        negocio.id,
        negocio.responsavel_id,
        emailObs,
        agendarD3,
        agendarD7
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      const msgs = ['E-mail registrado.']
      if (agendarD3) msgs.push('Follow-up D+3 agendado.')
      if (agendarD7) msgs.push('Follow-up D+7 agendado.')
      toast.success(msgs.join(' '))
      setEmailOpen(false)
      setEmailObs('')
      setAgendarD3(true)
      setAgendarD7(false)
    })
  }

  function handleEstagioChange(novoEstagio: EstagioNegocio) {
    if (novoEstagio === 'fechado_perdido' && estagio !== 'fechado_perdido') {
      // Intercepta e abre modal de motivo de perda sem alterar o Select ainda
      setMotivoSelecionado('')
      setMotivoOutro('')
      setPerdaOpen(true)
    } else {
      setEstagio(novoEstagio)
    }
  }

  function handleConfirmarPerda() {
    const motivo = motivoSelecionado === 'Outro' ? motivoOutro.trim() : motivoSelecionado
    if (!motivo) {
      toast.error('Informe o motivo da perda antes de confirmar.')
      return
    }

    startPerdaTransition(async () => {
      const result = await updateEstagioComData(
        negocio.id,
        'fechado_perdido',
        null,
        null,
        null,
        motivo
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      setEstagio('fechado_perdido')
      setPerdaOpen(false)
      toast.success('Negócio registrado como perdido.')
    })
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('estagio', estagio)
    formData.set('cliente_id', clienteId ?? '')
    formData.set('solucao_id', solucaoId ?? '')

    startEditTransition(async () => {
      const result = await updateNegocio(negocio.id, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Negócio atualizado com sucesso.')
      setEditOpen(false)
    })
  }

  return (
    <>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, negocio.id)}
        className="group relative flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-xs transition-shadow active:cursor-grabbing active:shadow-md hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-foreground leading-snug">
            {negocio.titulo}
          </span>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover:opacity-100 text-violet-500 hover:bg-violet-500/10 hover:text-violet-600"
              onClick={() => setReuniaoOpen(true)}
              aria-label="Registrar reunião"
            >
              <Video className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover:opacity-100 text-blue-500 hover:bg-blue-500/10 hover:text-blue-600"
              onClick={() => setEmailOpen(true)}
              aria-label="Registrar e-mail enviado"
            >
              <Mail className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
              onClick={() => setEditOpen(true)}
              aria-label="Editar negócio"
            >
              <Pencil className="size-3.5" />
            </Button>
            <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                />
              }
            >
              <Trash2 className="size-3.5" />
              <span className="sr-only">Excluir negócio</span>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir negócio</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir{' '}
                  <strong>{negocio.titulo}</strong>? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteIsPending}
                  onClick={handleDelete}
                >
                  {deleteIsPending ? 'Excluindo...' : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex flex-col gap-1.5 text-left"
        >
          {negocio.clientes && (
            <span className="text-xs font-medium text-muted-foreground">
              {negocio.clientes.razao_social}
            </span>
          )}

          {negocio.solucoes && (
            <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {negocio.solucoes.nome}
            </span>
          )}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-sm font-semibold text-foreground">
              {negocio.valor_estimado !== null
                ? formatBRL(negocio.valor_estimado)
                : (
                  <span className="text-xs font-normal text-muted-foreground/60">
                    Sem valor
                  </span>
                )
              }
            </span>
            {negocio.probabilidade !== null && (
              <Badge variant={getProbabilidadeVariant(negocio.probabilidade)}>
                {negocio.probabilidade}%
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-1 pt-0.5">
            {negocio.profiles && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="size-3 shrink-0" />
                <span className="truncate">
                  <span className="font-medium">Responsável:</span> {negocio.profiles.full_name}
                </span>
              </div>
            )}
            {negocio.data_previsao_fechamento && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="size-3 shrink-0" />
                <span>{formatDate(negocio.data_previsao_fechamento)}</span>
              </div>
            )}
            {negocio.data_previsao_original &&
              negocio.data_previsao_fechamento &&
              negocio.data_previsao_original !== negocio.data_previsao_fechamento && (
              <span className="mt-0.5 w-fit rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-medium text-red-500 tracking-wide">
                PRAZO ADIADO
              </span>
            )}

            {/* Badge de periodicidade — visível em Fechado Ganho */}
            {negocio.estagio === 'fechado_ganho' && negocio.periodicidade && (
              <span className="mt-0.5 w-fit inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">
                ↻ {PERIODICIDADE_LABELS[negocio.periodicidade]}
              </span>
            )}

            {/* Motivo de perda — visível em Perdido */}
            {negocio.estagio === 'fechado_perdido' && negocio.motivo_perda && (
              <p className="mt-1 text-[11px] text-muted-foreground/80 leading-snug line-clamp-2">
                <span className="font-medium">Motivo: </span>{negocio.motivo_perda}
              </p>
            )}

            {/* Badge SLA — alerta de negócio parado */}
            <SlaBadge negocio={negocio} />
          </div>
        </button>
      </div>

      {/* Dialog: registrar reunião com Google Calendar */}
      <RegistrarReuniaoDialog
        negocio={negocio}
        open={reuniaoOpen}
        onOpenChange={setReuniaoOpen}
        googleConnected={googleConnected}
      />

      {/* Dialog: registrar e-mail + agendar follow-ups */}
      <Dialog open={emailOpen} onOpenChange={(v) => { if (!emailIsPending) setEmailOpen(v) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4 text-blue-500" />
              Registrar E-mail Enviado
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Negócio: <strong className="text-foreground">{negocio.titulo}</strong>
              {negocio.clientes && (
                <> · <span>{negocio.clientes.razao_social}</span></>
              )}
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`email-obs-${negocio.id}`}>Notas (opcional)</Label>
              <Textarea
                id={`email-obs-${negocio.id}`}
                value={emailObs}
                onChange={(e) => setEmailObs(e.target.value)}
                placeholder="Ex: Enviei proposta comercial, aguardando retorno..."
                rows={2}
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-foreground">Agendar follow-ups automáticos</p>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agendarD3}
                  onChange={(e) => setAgendarD3(e.target.checked)}
                  className="size-4 rounded accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Lembrete em 3 dias (D+3)</p>
                  <p className="text-xs text-muted-foreground">
                    Você recebe um alerta para dar follow-up daqui 3 dias
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agendarD7}
                  onChange={(e) => setAgendarD7(e.target.checked)}
                  className="size-4 rounded accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Alerta em 7 dias (D+7)</p>
                  <p className="text-xs text-muted-foreground">
                    Se não houver resposta, alerta final no D+7
                  </p>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button onClick={handleRegistrarEmail} disabled={emailIsPending}>
              {emailIsPending ? 'Registrando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(v) => { if (!editIsPending) setEditOpen(v) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar negócio</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`titulo-${negocio.id}`}>
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`titulo-${negocio.id}`}
                name="titulo"
                required
                defaultValue={negocio.titulo}
                placeholder="Ex: Implantação ERP — Empresa XYZ"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>
                  Cliente <span className="text-destructive">*</span>
                </Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger className="w-full">
                    {clienteId ? (
                      <span className="flex flex-1 truncate text-left">
                        {clientes.find((c) => c.id === clienteId)?.razao_social ?? '—'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecione...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Solução <span className="text-destructive">*</span>
                </Label>
                <Select value={solucaoId} onValueChange={setSolucaoId}>
                  <SelectTrigger className="w-full">
                    {solucaoId ? (
                      <span className="flex flex-1 truncate text-left">
                        {solucoes.find((s) => s.id === solucaoId)?.nome ?? '—'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecione...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {solucoes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                Estágio <span className="text-destructive">*</span>
              </Label>
              <Select
                value={estagio}
                onValueChange={(v) => handleEstagioChange(v as EstagioNegocio)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTAGIOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`valor-${negocio.id}`}>Valor estimado (R$)</Label>
                <Input
                  id={`valor-${negocio.id}`}
                  name="valor_estimado"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={negocio.valor_estimado ?? ''}
                  placeholder="0,00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`prob-${negocio.id}`}>Probabilidade (%)</Label>
                <Input
                  id={`prob-${negocio.id}`}
                  name="probabilidade"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={negocio.probabilidade ?? ''}
                  placeholder="0 a 100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`data-${negocio.id}`}>Previsão de Fechamento</Label>
              <Input
                id={`data-${negocio.id}`}
                name="data_previsao_fechamento"
                type="date"
                defaultValue={negocio.data_previsao_fechamento ?? ''}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`obs-${negocio.id}`}>Observações</Label>
              <Textarea
                id={`obs-${negocio.id}`}
                name="observacoes"
                defaultValue={negocio.observacoes ?? ''}
                placeholder="Informações adicionais sobre o negócio..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={editIsPending || !clienteId || !solucaoId}>
                {editIsPending ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: motivo de perda — intercepta mudança de estágio para fechado_perdido */}
      <Dialog
        open={perdaOpen}
        onOpenChange={(v) => {
          if (!perdaIsPending) setPerdaOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Motivo de Perda</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione o motivo pelo qual o negócio{' '}
            <strong className="text-foreground">{negocio.titulo}</strong> não foi fechado.
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Motivo</Label>
              <Select value={motivoSelecionado} onValueChange={(v) => setMotivoSelecionado(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_PERDA.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {motivoSelecionado === 'Outro' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`motivo-outro-${negocio.id}`}>Descreva o motivo</Label>
                <Textarea
                  id={`motivo-outro-${negocio.id}`}
                  value={motivoOutro}
                  onChange={(e) => setMotivoOutro(e.target.value)}
                  placeholder="Descreva o que levou à perda deste negócio..."
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              disabled={
                perdaIsPending ||
                !motivoSelecionado ||
                (motivoSelecionado === 'Outro' && !motivoOutro.trim())
              }
              onClick={handleConfirmarPerda}
            >
              {perdaIsPending ? 'Registrando...' : 'Confirmar Perda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
