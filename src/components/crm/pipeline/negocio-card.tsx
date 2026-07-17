'use client'

import { useState, useTransition, useEffect, useId } from 'react'
import { toast } from 'sonner'
import { Trash2, User, Calendar, Pencil, Mail, AlertTriangle, Clock, Video, Plus } from 'lucide-react'
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
import { gerarFinanceiroDoFechamento } from '@/app/(crm)/pipeline/fechamento-financeiro-actions'
import { getNegocioProdutos } from '@/app/(crm)/pipeline/produtos-actions'
import { registrarEmailComFollowups } from '@/app/(crm)/pipeline/followup-actions'
import { RegistrarReuniaoDialog } from './registrar-reuniao-dialog'
import { BotaoLembrete } from './botao-lembrete'
import type { NegocioComRelacoes, EstagioNegocio, Cliente, Solucao, Periodicidade, Parceiro, Profile } from '@/types'
import type { EstagioPipeline } from '@/lib/pipeline-estagios'
import { PIPELINE_CONFIG_DEFAULT, type PipelineConfig } from '@/lib/pipeline-config'

// ── Helpers de valor BR ───────────────────────────────────────────────────────

function formatBRLInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const cents = parseInt(digits, 10)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function parseBRLInput(formatted: string): number {
  if (!formatted) return 0
  return Number(formatted.replace(/\./g, '').replace(',', '.')) || 0
}

function todayISO(): string {
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

// ── Linha de produto (igual ao negocio-form) ──────────────────────────────────

interface ProdutoLinha {
  key: string
  solucaoId: string | null
  valorFormatado: string
}

function novaProdutoLinha(solucaoId?: string | null, valor?: number): ProdutoLinha {
  return {
    key: Math.random().toString(36).slice(2),
    solucaoId: solucaoId ?? null,
    valorFormatado: valor ? formatBRLInput(String(Math.round(valor * 100))) : '',
  }
}

// ── Indicador helpers ──────────────────────────────────────────────────────────

type IndicadorTipo = 'parceiro' | 'time' | null
const PREFIX_PARCEIRO = 'p:'
const PREFIX_TIME = 't:'

function encodeIndicador(tipo: IndicadorTipo, id: string | null): string {
  if (!tipo || !id) return ''
  return tipo === 'parceiro' ? `${PREFIX_PARCEIRO}${id}` : `${PREFIX_TIME}${id}`
}

function decodeIndicador(value: string): { tipo: IndicadorTipo; id: string | null } {
  if (value.startsWith(PREFIX_PARCEIRO))
    return { tipo: 'parceiro', id: value.slice(PREFIX_PARCEIRO.length) }
  if (value.startsWith(PREFIX_TIME))
    return { tipo: 'time', id: value.slice(PREFIX_TIME.length) }
  return { tipo: null, id: null }
}

// SLA padrão em dias para qualquer etapa do tipo 'aberto' sem configuração específica.
const SLA_PADRAO_ABERTO = 14

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
  estagios: EstagioPipeline[]
}

function SlaBadge({ negocio, estagios }: SlaBadgeProps) {
  // Só exibe para etapas do tipo 'aberto' — funciona com qualquer slug de tenant
  const estagioAtual = estagios.find((e) => e.slug === negocio.estagio)
  if (estagioAtual?.tipo !== 'aberto') return null

  const sla = SLA_PADRAO_ABERTO
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

/** Selinho verde do WhatsApp — SVG inline, sem pacote de ícones novo. */
function WhatsAppBadge() {
  return (
    <span
      className="absolute -right-1 -top-1 z-10 flex size-4 items-center justify-center rounded-full bg-[#25D366] shadow-sm ring-2 ring-card"
      title="Lead via WhatsApp"
    >
      <svg viewBox="0 0 24 24" className="size-2.5" fill="white" aria-hidden="true">
        <path d="M12 2.1c-5.5 0-10 4.4-10 9.9 0 1.7.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.4 10-9.9s-4.5-9.8-10-9.8zm5.6 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.2-4.3-3.7-4.5-3.9-.1-.2-1-1.4-1-2.6s.6-1.9.9-2.1c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.8 2 .9 2.1.1.2.1.4 0 .6-.1.2-.2.4-.4.6-.2.2-.4.4-.5.6-.2.2-.4.4-.2.8.2.4 1 1.6 2.1 2.6 1.4 1.3 2.6 1.7 3 1.9.4.2.6.1.8-.1.3-.3.9-1 1.1-1.3.2-.3.5-.3.8-.2l2 .9c.3.2.5.3.6.4.1.2.1.9-.1 1.4z" />
      </svg>
    </span>
  )
}

interface NegocioCardProps {
  negocio: NegocioComRelacoes
  clientes: Pick<Cliente, 'id' | 'razao_social'>[]
  solucoes: Pick<Solucao, 'id' | 'nome'>[]
  estagios: EstagioPipeline[]
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void
  googleConnected: boolean
  onMoverPara?: (slug: string) => void
  parceiros?: Pick<Parceiro, 'id' | 'nome'>[]
  membrosTime?: Pick<Profile, 'id' | 'full_name'>[]
  pipelineConfig?: PipelineConfig
}

export function NegocioCard({ negocio, clientes, solucoes, estagios, onDragStart, googleConnected, onMoverPara, parceiros = [], membrosTime = [], pipelineConfig = PIPELINE_CONFIG_DEFAULT }: NegocioCardProps) {
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
  const [emailObs, setEmailObs] = useState('')
  const [agendarD3, setAgendarD3] = useState(true)
  const [agendarD7, setAgendarD7] = useState(false)
  const [motivoSelecionado, setMotivoSelecionado] = useState('')
  const [motivoOutro, setMotivoOutro] = useState('')
  const [slugPerdaDestino, setSlugPerdaDestino] = useState<string>('fechado_perdido')
  const [dataFechamentoPerda, setDataFechamentoPerda] = useState(() => todayISO())
  const [ganhoOpen, setGanhoOpen] = useState(false)
  const [ganhoIsPending, startGanhoTransition] = useTransition()
  const [slugGanhoDestino, setSlugGanhoDestino] = useState<string>('fechado_ganho')
  const [dataFechamentoGanho, setDataFechamentoGanho] = useState(() => todayISO())
  const [periodicidadeGanho, setPeriodicidadeGanho] = useState<string>('mensal')
  const [gerarFinanceiroGanho, setGerarFinanceiroGanho] = useState(true)

  // ── Produtos (edit inline) ──────────────────────────────────────────────────
  const [produtos, setProdutos] = useState<ProdutoLinha[]>([
    novaProdutoLinha(negocio.solucao_id, negocio.valor_estimado ?? undefined),
  ])
  const [produtosCarregados, setProdutosCarregados] = useState(false)
  const [isLoadingProdutos, setIsLoadingProdutos] = useState(false)
  const [erroProdutos, setErroProdutos] = useState(false)

  // ── Indicador (edit inline) ────────────────────────────────────────────────
  function resolveIndicadorInicial(): string {
    if (negocio.parceiro_id) return encodeIndicador('parceiro', negocio.parceiro_id)
    if (negocio.indicado_por) return encodeIndicador('time', negocio.indicado_por)
    return ''
  }
  const [indicadorValue, setIndicadorValue] = useState<string>(resolveIndicadorInicial())

  function indicadorLabel(): string {
    if (!indicadorValue) return ''
    const { tipo, id } = decodeIndicador(indicadorValue)
    if (tipo === 'parceiro') return parceiros.find((p) => p.id === id)?.nome ?? '—'
    if (tipo === 'time') return membrosTime.find((m) => m.id === id)?.full_name ?? '—'
    return ''
  }

  const uid = useId()

  // Carrega produtos reais ao abrir o edit dialog
  useEffect(() => {
    if (!editOpen) return
    if (produtosCarregados) return

    setIsLoadingProdutos(true)
    setErroProdutos(false)
    getNegocioProdutos(negocio.id)
      .then((rows) => {
        if (rows.length > 0) {
          setProdutos(rows.map((r) => novaProdutoLinha(r.solucao_id, r.valor)))
        } else {
          setProdutos([novaProdutoLinha(negocio.solucao_id, negocio.valor_estimado ?? undefined)])
        }
        setProdutosCarregados(true)
      })
      .catch(() => {
        setErroProdutos(true)
        toast.error('Erro ao carregar produtos.')
      })
      .finally(() => setIsLoadingProdutos(false))
  }, [editOpen, negocio.id, produtosCarregados, negocio.solucao_id, negocio.valor_estimado])

  // Total ao vivo
  const totalProdutos = produtos.reduce((acc, p) => acc + parseBRLInput(p.valorFormatado), 0)
  const primeiraSolucaoId = produtos[0]?.solucaoId ?? ''

  function addProduto() {
    setProdutos((prev) => [...prev, novaProdutoLinha()])
  }

  function removeProduto(key: string) {
    setProdutos((prev) => (prev.length > 1 ? prev.filter((p) => p.key !== key) : prev))
  }

  function setProdutoSolucao(key: string, solucaoId: string | null) {
    setProdutos((prev) => prev.map((p) => (p.key === key ? { ...p, solucaoId } : p)))
  }

  function setProdutoValor(key: string, raw: string) {
    const formatted = formatBRLInput(raw)
    setProdutos((prev) => prev.map((p) => (p.key === key ? { ...p, valorFormatado: formatted } : p)))
  }

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
    const estagioDestino = estagios.find((e) => e.slug === novoEstagio)
    if (estagioDestino?.tipo === 'perdido' && estagio !== novoEstagio) {
      // Intercepta e abre modal de motivo de perda sem alterar o Select ainda
      setSlugPerdaDestino(novoEstagio)
      setMotivoSelecionado('')
      setMotivoOutro('')
      setDataFechamentoPerda(todayISO())
      setPerdaOpen(true)
    } else if (estagioDestino?.tipo === 'ganho' && estagio !== novoEstagio) {
      // Intercepta e abre modal de confirmação de ganho sem alterar o Select ainda
      setSlugGanhoDestino(novoEstagio)
      setDataFechamentoGanho(todayISO())
      setPeriodicidadeGanho('mensal')
      setGerarFinanceiroGanho(true)
      setGanhoOpen(true)
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
        slugPerdaDestino,
        null,
        null,
        dataFechamentoPerda || todayISO(),
        motivo
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      setEstagio(slugPerdaDestino as EstagioNegocio)
      setPerdaOpen(false)
      toast.success('Negócio registrado como perdido.')
    })
  }

  function handleConfirmarGanho() {
    startGanhoTransition(async () => {
      const dataFinal = dataFechamentoGanho || todayISO()
      const result = await updateEstagioComData(
        negocio.id,
        slugGanhoDestino,
        null,
        periodicidadeGanho,
        dataFinal,
        null
      )
      if (result.error) {
        toast.error(result.error)
        return
      }

      if (gerarFinanceiroGanho && result.transicionou !== false) {
        const finResult = await gerarFinanceiroDoFechamento({
          negocioId: negocio.id,
          dataFechamento: dataFinal,
          periodicidade: periodicidadeGanho,
        })
        if (finResult.error) {
          toast.success('Negócio marcado como ganho!')
          toast.error(`Financeiro: ${finResult.error}`)
        } else {
          toast.success(`Negócio ganho! ${finResult.mensagem}`)
        }
      } else {
        toast.success('Negócio marcado como ganho!')
      }
      setEstagio(slugGanhoDestino as EstagioNegocio)
      setGanhoOpen(false)
    })
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('estagio', estagio)
    formData.set('cliente_id', clienteId ?? '')
    formData.set('solucao_id', primeiraSolucaoId)

    // Serializa produtos
    formData.set('produtos_count', String(produtos.length))
    produtos.forEach((p, i) => {
      formData.set(`produto_solucao_${i}`, p.solucaoId ?? '')
      formData.set(`produto_valor_${i}`, p.valorFormatado)
    })

    // Indicador
    const { tipo: indTipo, id: indId } = decodeIndicador(indicadorValue)
    formData.set('parceiro_id', indTipo === 'parceiro' && indId ? indId : '')
    formData.set('indicado_por', indTipo === 'time' && indId ? indId : '')

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
        {negocio.origem === 'whatsapp' && <WhatsAppBadge />}

        <div className="flex items-start justify-between gap-2">
          <span
            title={negocio.titulo}
            className="truncate min-w-0 flex-1 text-sm font-medium text-foreground leading-snug"
          >
            {negocio.titulo}
          </span>

          <div className="flex shrink-0 items-center gap-0.5 [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:flex">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-violet-500 hover:bg-violet-500/10 hover:text-violet-600"
              onClick={() => setReuniaoOpen(true)}
              aria-label="Registrar reunião"
            >
              <Video className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-blue-500 hover:bg-blue-500/10 hover:text-blue-600"
              onClick={() => setEmailOpen(true)}
              aria-label="Registrar e-mail enviado"
            >
              <Mail className="size-3.5" />
            </Button>
            <BotaoLembrete
              negocioId={negocio.id}
              clienteNome={negocio.clientes?.razao_social ?? negocio.titulo}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
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
                  className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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

            {/* Indicador: Parceiro ou Time */}
            {negocio.parceiro_id && negocio.parceiros && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-[8px] font-bold">P</span>
                <span className="truncate">
                  <span className="font-medium">Parceiro:</span> {negocio.parceiros.nome}
                </span>
              </div>
            )}
            {negocio.indicado_por && negocio.indicador && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 text-[8px] font-bold">T</span>
                <span className="truncate">
                  <span className="font-medium">Indicado por:</span> {negocio.indicador.full_name}
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

            {/* Badge de periodicidade — visível em etapas do tipo 'ganho' */}
            {estagios.find((e) => e.slug === negocio.estagio)?.tipo === 'ganho' && negocio.periodicidade && (
              <span className="mt-0.5 w-fit inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">
                ↻ {PERIODICIDADE_LABELS[negocio.periodicidade]}
              </span>
            )}

            {/* Motivo de perda — visível em etapas do tipo 'perdido' */}
            {estagios.find((e) => e.slug === negocio.estagio)?.tipo === 'perdido' && negocio.motivo_perda && (
              <p className="mt-1 text-[11px] text-muted-foreground/80 leading-snug line-clamp-2">
                <span className="font-medium">Motivo: </span>{negocio.motivo_perda}
              </p>
            )}

            {/* Badge SLA — alerta de negócio parado */}
            <SlaBadge negocio={negocio} estagios={estagios} />
          </div>
        </button>

        {/* Mover para: alternativa touch/teclado ao drag */}
        <select
          value=""
          onChange={(e) => {
            const val = e.target.value
            if (val) onMoverPara?.(val)
          }}
          className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
          aria-label="Mover negócio para outro estágio"
        >
          <option value="" disabled>Mover para...</option>
          {estagios.filter((e) => e.slug !== negocio.estagio).map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.nome}
            </option>
          ))}
        </select>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar negócio</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            {/* Título */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-titulo`}>
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${uid}-titulo`}
                name="titulo"
                required
                defaultValue={negocio.titulo}
                placeholder="Ex: Implantação ERP — Empresa XYZ"
              />
            </div>

            {/* Cliente */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Cliente {pipelineConfig.exige_cliente && <span className="text-destructive">*</span>}
              </Label>
              <Select value={clienteId ?? ''} onValueChange={(v) => setClienteId(v || null)}>
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
                  {!pipelineConfig.exige_cliente && <SelectItem value="">Nenhum</SelectItem>}
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estágio */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Estágio <span className="text-destructive">*</span>
              </Label>
              <Select
                value={estagio}
                onValueChange={(v) => handleEstagioChange(v as EstagioNegocio)}
              >
                <SelectTrigger className="w-full">
                  {estagios.find((e) => e.slug === estagio)?.nome ?? estagio}
                </SelectTrigger>
                <SelectContent>
                  {estagios.map((e) => (
                    <SelectItem key={e.slug} value={e.slug}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── PRODUTOS ────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>
                  Produtos / Soluções {pipelineConfig.exige_produto && <span className="text-destructive">*</span>}
                  {!pipelineConfig.exige_produto && (
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  )}
                </Label>
                {isLoadingProdutos && (
                  <span className="text-xs text-muted-foreground">Carregando...</span>
                )}
              </div>
              {erroProdutos && (
                <p className="text-xs text-destructive">
                  Não foi possível carregar os produtos — reabra para tentar de novo.
                </p>
              )}

              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
                {produtos.map((prod, idx) => (
                  <div key={prod.key} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Select
                        value={prod.solucaoId ?? ''}
                        onValueChange={(v) => setProdutoSolucao(prod.key, v || null)}
                      >
                        <SelectTrigger className="w-full">
                          {prod.solucaoId ? (
                            <span className="flex flex-1 truncate text-left text-sm">
                              {solucoes.find((s) => s.id === prod.solucaoId)?.nome ?? '—'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Solução...</span>
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

                    <div className="w-36 shrink-0">
                      <Input
                        inputMode="numeric"
                        placeholder="0,00"
                        value={prod.valorFormatado}
                        onChange={(e) => setProdutoValor(prod.key, e.target.value)}
                        aria-label={`Valor do produto ${idx + 1}`}
                        className="text-right"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={produtos.length === 1}
                      onClick={() => removeProduto(prod.key)}
                      aria-label="Remover produto"
                      className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addProduto}
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                    Adicionar produto
                  </Button>
                  <span className="text-sm font-semibold text-foreground">
                    Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalProdutos)}
                  </span>
                </div>
              </div>
            </div>

            {/* Probabilidade + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-prob`}>Probabilidade (%)</Label>
                <Input
                  id={`${uid}-prob`}
                  name="probabilidade"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={negocio.probabilidade ?? ''}
                  placeholder="0 a 100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-data`}>Previsão de Fechamento</Label>
                <Input
                  id={`${uid}-data`}
                  name="data_previsao_fechamento"
                  type="date"
                  defaultValue={negocio.data_previsao_fechamento ?? ''}
                />
              </div>
            </div>

            {/* ── INDICADOR ──────────────────────────────────────────────── */}
            {(parceiros.length > 0 || membrosTime.length > 0) && (
              <div className="flex flex-col gap-1.5">
                <Label>Indicador</Label>
                <Select value={indicadorValue} onValueChange={(v) => setIndicadorValue(v ?? '')}>
                  <SelectTrigger className="w-full">
                    {indicadorValue ? (
                      <span className="flex flex-1 truncate text-left">
                        {indicadorLabel()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nenhum...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {parceiros.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Parceiros</div>
                        {parceiros.map((p) => (
                          <SelectItem key={p.id} value={encodeIndicador('parceiro', p.id)}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {membrosTime.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Time</div>
                        {membrosTime.map((m) => (
                          <SelectItem key={m.id} value={encodeIndicador('time', m.id)}>
                            {m.full_name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Observações */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-obs`}>Observações</Label>
              <Textarea
                id={`${uid}-obs`}
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
              <Button
                type="submit"
                disabled={
                  editIsPending ||
                  isLoadingProdutos ||
                  erroProdutos ||
                  (pipelineConfig.exige_cliente && !clienteId) ||
                  (pipelineConfig.exige_produto && !primeiraSolucaoId)
                }
              >
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
              <Label htmlFor={`data-fechamento-perda-${negocio.id}`}>Data de Fechamento</Label>
              <Input
                id={`data-fechamento-perda-${negocio.id}`}
                type="date"
                value={dataFechamentoPerda}
                onChange={(e) => setDataFechamentoPerda(e.target.value)}
              />
            </div>

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

      {/* Dialog: confirmar ganho — intercepta mudança de estágio para tipo 'ganho' */}
      <Dialog
        open={ganhoOpen}
        onOpenChange={(v) => {
          if (!ganhoIsPending) setGanhoOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Ganho</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Registre os detalhes do fechamento de{' '}
            <strong className="text-foreground">{negocio.titulo}</strong>.
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`data-fechamento-ganho-${negocio.id}`}>Data de Fechamento</Label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDataFechamentoGanho(primeiroDiaMes(0))}
                >
                  Mês vigente
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDataFechamentoGanho(primeiroDiaMes(1))}
                >
                  Próximo mês
                </Button>
              </div>
              <Input
                id={`data-fechamento-ganho-${negocio.id}`}
                type="date"
                value={dataFechamentoGanho}
                onChange={(e) => setDataFechamentoGanho(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Periodicidade</Label>
              <Select
                value={periodicidadeGanho}
                onValueChange={(v) => { if (v) setPeriodicidadeGanho(v) }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIODICIDADE_LABELS).map(([valor, label]) => (
                    <SelectItem key={valor} value={valor}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 hover:bg-emerald-50 transition-colors">
              <input
                type="checkbox"
                checked={gerarFinanceiroGanho}
                onChange={(e) => setGerarFinanceiroGanho(e.target.checked)}
                className="mt-0.5 size-4 accent-emerald-600 cursor-pointer"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Gerar conta a receber e comissão</span>
                <span className="text-xs text-muted-foreground">
                  Cria automaticamente a conta a receber no financeiro e a comissão prevista para o responsável pelo negócio.
                </span>
              </div>
            </label>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button disabled={ganhoIsPending} onClick={handleConfirmarGanho}>
              {ganhoIsPending ? 'Salvando...' : 'Confirmar Ganho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
