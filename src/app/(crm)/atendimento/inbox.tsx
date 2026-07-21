'use client'

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MessagesSquare, Bot, User, CheckCheck, CornerUpLeft,
  Search, Plus, Check, X, Loader2, ArrowLeft, Send, UserPlus,
  Archive, ArchiveRestore, AlertCircle, FileText, Paperclip,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select'
import {
  assumirConversa, devolverAoBot, resolverConversa, marcarLida,
  arquivarConversa, desarquivarConversa, enviarMidiaConversa,
  iniciarConversa, reabrirConversaComTemplate, responderConversa,
  salvarContatoConversa, buscarClientesPorNome, vincularClienteExistente,
  verificarJanela24hWhatsApp,
} from './atendimento-actions'

export interface Conversa {
  id: string
  wa_number: string | null
  etapa: string | null
  ia_ativa: boolean | null
  encaminhado: boolean | null
  status: 'bot' | 'humano' | 'resolvido' | 'adiado' | null
  assignee_id: string | null
  last_inbound_at: string | null
  unread_count: number | null
  snooze_until: string | null
  labels: string[] | null
  arquivada: boolean | null
  created_at: string | null
  updated_at: string | null
  cliente_id: string | null
  clientes: { razao_social: string } | null
}

export interface ClienteComTelefone {
  id: string
  razao_social: string
  contato_telefone: string
}

/** Nome do cliente vinculado, ou o número cru se ainda não foi salvo como contato. */
function nomeOuNumero(conv: Pick<Conversa, 'wa_number' | 'clientes'>): string {
  return conv.clientes?.razao_social || conv.wa_number || 'Sem número'
}

/**
 * Últimos 8 dígitos de um telefone — números BR variam em DDI (55) e no 9º dígito
 * do celular, mas os 8 dígitos finais são estáveis entre formatos. Mesma lógica de
 * `atendimento-actions.ts` (duplicada de propósito: uma é server-only, a outra roda
 * no cliente pra sugerir o match sem precisar de uma chamada extra ao servidor).
 */
function ultimosDigitos(tel: string): string {
  return tel.replace(/\D/g, '').slice(-8)
}

export interface Mensagem {
  id: string
  conversation_id: string | null
  direction: 'in' | 'out' | null
  texto: string | null
  author_type: 'lead' | 'bot' | 'humano' | 'sistema' | null
  delivery_status: string | null
  delivery_erro: string | null
  media_url: string | null
  media_mime: string | null
  created_at: string | null
}

type Status = NonNullable<Conversa['status']>
const STATUS_LABEL: Record<Status, string> = { bot: 'Bot', humano: 'Humano', resolvido: 'Resolvido', adiado: 'Adiado' }
const STATUS_BADGE: Record<Status, string> = {
  bot: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  humano: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  resolvido: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  adiado: 'bg-muted text-muted-foreground',
}
const AUTHOR_LABEL: Record<NonNullable<Mensagem['author_type']>, string> = {
  lead: 'Lead', bot: 'Leila (bot)', humano: 'Atendente', sistema: 'Sistema',
}

function formatarHorario(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const agora = new Date()
  const mesmoDia = d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate()
  return mesmoDia
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function formatarDataHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

interface InboxProps {
  conversas: Conversa[]
  selecionada: Conversa | null
  mensagens: Mensagem[]
  clientesComTelefone: ClienteComTelefone[]
}

export function Inbox({ conversas, selecionada, mensagens, clientesComTelefone }: InboxProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas' | 'arquivadas'>('todas')
  const [novaAberta, setNovaAberta] = useState(false)
  const [mobileView, setMobileView] = useState<'lista' | 'thread'>('lista')

  function executar(fn: (id: string) => Promise<{ error?: string }>, id: string, sucesso: string) {
    startTransition(async () => {
      const res = await fn(id)
      if (res?.error) { toast.error(res.error); return }
      toast.success(sucesso)
      router.refresh()
    })
  }

  const termo = busca.trim().toLowerCase()
  const filtradas = conversas.filter((c) => {
    // Arquivadas só aparecem na aba própria; nas demais ficam ocultas.
    if (filtro === 'arquivadas') {
      if (!c.arquivada) return false
    } else if (c.arquivada) {
      return false
    }
    if (filtro === 'nao_lidas' && (c.unread_count ?? 0) === 0) return false
    if (termo && !(c.wa_number ?? '').toLowerCase().includes(termo)) return false
    return true
  })
  const naoLidasTotal = conversas.filter((c) => !c.arquivada && (c.unread_count ?? 0) > 0).length

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atendimento</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Conversas do WhatsApp atendidas pelo robô (Leila).
          </p>
        </div>
        <Button onClick={() => setNovaAberta(true)}>
          <Plus /> Nova conversa
        </Button>
      </div>

      <div className="flex h-[calc(100vh-16rem)] overflow-hidden rounded-xl border border-border bg-card">
        {/* Lista (esquerda) */}
        <div className={cn('w-full max-w-xs shrink-0 flex-col border-r border-border md:max-w-sm', mobileView === 'thread' ? 'hidden md:flex' : 'flex')}>
          {/* Busca */}
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar pelo número..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            {/* Filtros */}
            <div className="mt-2 flex gap-1.5">
              <FiltroPill ativo={filtro === 'todas'} onClick={() => setFiltro('todas')}>
                Todas
              </FiltroPill>
              <FiltroPill ativo={filtro === 'nao_lidas'} onClick={() => setFiltro('nao_lidas')}>
                Não lidas{naoLidasTotal > 0 ? ` (${naoLidasTotal})` : ''}
              </FiltroPill>
              <FiltroPill ativo={filtro === 'arquivadas'} onClick={() => setFiltro('arquivadas')}>
                Arquivadas
              </FiltroPill>
            </div>
          </div>

          {/* Conversas */}
          <div className="flex flex-1 flex-col overflow-y-auto">
            {filtradas.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                <MessagesSquare className="size-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  {conversas.length === 0
                    ? 'Nenhuma conversa ainda. As conversas do WhatsApp aparecerão aqui.'
                    : 'Nenhuma conversa encontrada com esse filtro.'}
                </p>
              </div>
            ) : (
              filtradas.map((conv) => {
                const ativa = conv.id === selecionada?.id
                const status = conv.status ?? 'bot'
                const naoLidas = conv.unread_count ?? 0
                return (
                  <Link
                    key={conv.id}
                    href={`/atendimento?c=${conv.id}`}
                    onClick={() => setMobileView('thread')}
                    className={cn(
                      'flex flex-col gap-1 border-b border-border px-3 py-2.5 transition-colors hover:bg-muted/60',
                      ativa && 'bg-muted',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{nomeOuNumero(conv)}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatarHorario(conv.last_inbound_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[status])}>
                        {STATUS_LABEL[status]}
                      </span>
                      {naoLidas > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                          {naoLidas}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Thread (direita) */}
        <div className={cn('min-w-0 flex-1 flex-col', mobileView === 'lista' ? 'hidden md:flex' : 'flex')}>
          {selecionada ? (
            <Thread
              conversa={selecionada}
              mensagens={mensagens}
              isPending={isPending}
              clientesComTelefone={clientesComTelefone}
              onVoltar={() => setMobileView('lista')}
              onAssumir={() => executar(assumirConversa, selecionada.id, 'Conversa assumida.')}
              onDevolver={() => executar(devolverAoBot, selecionada.id, 'Conversa devolvida ao bot.')}
              onResolver={() => executar(resolverConversa, selecionada.id, 'Conversa resolvida.')}
              onMarcarLida={() => executar(marcarLida, selecionada.id, 'Marcada como lida.')}
              onArquivar={() =>
                selecionada.arquivada
                  ? executar(desarquivarConversa, selecionada.id, 'Conversa desarquivada.')
                  : executar(arquivarConversa, selecionada.id, 'Conversa arquivada.')
              }
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <MessagesSquare className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Selecione uma conversa à esquerda para ver as mensagens.</p>
            </div>
          )}
        </div>
      </div>

      {novaAberta && (
        <NovaConversaDialog onClose={() => setNovaAberta(false)} clientes={clientesComTelefone} />
      )}
    </div>
  )
}

function FiltroPill({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        ativo ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Nova conversa (humano inicia)
// ---------------------------------------------------------------------------
function NovaConversaDialog({ onClose, clientes }: { onClose: () => void; clientes: ClienteComTelefone[] }) {
  const router = useRouter()
  const [clienteId, setClienteId] = useState<string | undefined>(undefined)
  const [numero, setNumero] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, startEnviar] = useTransition()
  const [reabrindo, startReabrir] = useTransition()
  // true quando iniciarConversa devolveu foraDaJanela24h (reativo) OU quando a
  // checagem prévia abaixo já detectou que o contato esfriou (proativo) —
  // troca os botões pela opção de reabrir com o template em vez do texto livre.
  const [foraDaJanela, setForaDaJanela] = useState(false)
  const checagemIdRef = useRef(0)

  // Checagem proativa: ao digitar um número válido, verifica (com debounce) se
  // o contato já conversou nas últimas 24h — evita a tentativa de texto livre
  // fadada a falhar quando é um contato que nunca falou com a empresa.
  const numeroValido = numero.replace(/\D/g, '').length >= 10
  useEffect(() => {
    if (!numeroValido) return
    const meuId = ++checagemIdRef.current
    const timer = setTimeout(() => {
      verificarJanela24hWhatsApp(numero).then((res) => {
        if (checagemIdRef.current !== meuId) return // número já mudou, resposta desatualizada
        setForaDaJanela(!res.dentroDaJanela)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [numero, numeroValido])

  function escolherCliente(id: string | undefined) {
    setClienteId(id)
    const cliente = clientes.find((c) => c.id === id)
    if (cliente) setNumero(cliente.contato_telefone)
  }

  function iniciar() {
    if (!numero.trim()) { toast.error('Informe o número.'); return }
    startEnviar(async () => {
      const res = await iniciarConversa(numero, mensagem, clienteId)
      if (res.error) {
        if (res.foraDaJanela24h) { setForaDaJanela(true); return }
        toast.error(res.error)
        return
      }
      toast.success('Conversa criada.')
      onClose()
      if (res.id) router.push(`/atendimento?c=${res.id}`)
      else router.refresh()
    })
  }

  function reabrirComTemplate() {
    startReabrir(async () => {
      const res = await reabrirConversaComTemplate(numero, clienteId)
      if (res.error) { toast.error(res.error); return }
      toast.success('Mensagem-modelo enviada. Assim que o cliente responder, dá pra conversar livremente.')
      onClose()
      if (res.id) router.push(`/atendimento?c=${res.id}`)
      else router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Nova conversa</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="flex flex-col gap-3">
          {clientes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cliente já cadastrado (opcional)</label>
              <Select value={clienteId} onValueChange={(v) => escolherCliente(v ?? undefined)}>
                <SelectTrigger className="w-full">
                  {clienteId ? (
                    <span className="flex flex-1 truncate text-left">
                      {clientes.find((c) => c.id === clienteId)?.razao_social ?? '—'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Nenhum — digitar número manualmente</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razao_social} · {c.contato_telefone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Número do contato (com DDD)</label>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: (71) 99999-8888"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Primeira mensagem (opcional)</label>
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} placeholder="Escreva a mensagem inicial..."
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40" />
          </div>
          {foraDaJanela && numeroValido ? (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                Esse contato não fala com você há mais de 24h — o WhatsApp exige uma mensagem-modelo
                para reabrir contato. Ao confirmar, será enviada a <strong>mensagem padrão aprovada</strong>,
                não o texto digitado acima. Assim que ele responder, a conversa reabre e você volta a
                conversar livremente.
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setForaDaJanela(false)} disabled={reabrindo}>
                  <X /> Voltar
                </Button>
                <Button size="sm" onClick={reabrirComTemplate} disabled={reabrindo}>
                  {reabrindo ? <Loader2 className="animate-spin" /> : <Send />} Reabrir conversa
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
              <Button onClick={iniciar} disabled={enviando}>
                {enviando ? <Loader2 className="animate-spin" /> : <Plus />} Iniciar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface ThreadProps {
  conversa: Conversa
  mensagens: Mensagem[]
  isPending: boolean
  clientesComTelefone: ClienteComTelefone[]
  onVoltar: () => void
  onAssumir: () => void
  onDevolver: () => void
  onResolver: () => void
  onMarcarLida: () => void
  onArquivar: () => void
}

/**
 * Preview de mídia dentro do balão da mensagem. `media_url` chega da page.tsx já
 * como URL assinada (1h) do bucket privado — ou null se a mídia falhou ao gerar
 * o link (arquivo sumiu, erro de rede etc.), mesmo a mensagem tendo tido mídia
 * (`media_mime` não-nulo nesse caso). Sem mídia nenhuma, não renderiza nada.
 */
function MidiaMensagem({ mediaUrl, mediaMime }: { mediaUrl: string | null; mediaMime: string | null }) {
  if (!mediaMime) return null

  if (!mediaUrl) {
    return <p className="mb-1 text-xs italic opacity-70">Mídia indisponível</p>
  }

  if (mediaMime.startsWith('image/')) {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária (1h), não vale otimizar/cachear via next/image */}
        <img src={mediaUrl} alt="Imagem enviada" className="max-w-full rounded-lg" />
      </a>
    )
  }

  if (mediaMime.startsWith('audio/')) {
    return <audio controls src={mediaUrl} className="mb-1 max-w-full" />
  }

  if (mediaMime.startsWith('video/')) {
    return <video controls src={mediaUrl} className="mb-1 max-w-full rounded-lg" />
  }

  const rotulo = mediaMime === 'application/pdf' ? 'Documento PDF' : 'Arquivo'
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className="mb-1 flex items-center gap-2 rounded-lg border border-current/20 px-2.5 py-2 opacity-90 hover:opacity-100"
    >
      <FileText className="size-4 shrink-0" />
      <span className="text-sm underline underline-offset-2">{rotulo}</span>
    </a>
  )
}

/**
 * ✓/✓✓/✓✓ azul do WhatsApp — só faz sentido pra mensagem ENVIADA (direction
 * 'out'). O backend (webhook do app-sdr) já atualiza `delivery_status` via
 * `statuses[]` da Meta; aqui é só a exibição.
 */
function StatusEntrega({ status, erro }: { status: string | null; erro: string | null }) {
  if (status === 'read') return <CheckCheck className="size-3.5 text-blue-400" />
  if (status === 'delivered') return <CheckCheck className="size-3.5 opacity-70" />
  if (status === 'sent') return <Check className="size-3.5 opacity-70" />
  if (status === 'failed') {
    return (
      <span title={erro ?? 'Falha ao entregar'}>
        <AlertCircle className="size-3.5 text-destructive" />
      </span>
    )
  }
  return null
}

/** MIME aceito no anexo — mesma allow-list validada de novo no server (enviarMidiaConversa). */
const MIME_MIDIA_ENVIO = ['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'application/pdf']
const TAMANHO_MAXIMO_MIDIA_BYTES = 4 * 1024 * 1024

function Thread({ conversa, mensagens, isPending, clientesComTelefone, onVoltar, onAssumir, onDevolver, onResolver, onMarcarLida, onArquivar }: ThreadProps) {
  const router = useRouter()
  const status = conversa.status ?? 'bot'
  const [resposta, setResposta] = useState('')
  const [enviando, startEnviar] = useTransition()
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [salvandoContato, setSalvandoContato] = useState(false)
  const anexoRef = useRef<HTMLInputElement>(null)
  // true quando responderConversa devolveu foraDaJanela24h — troca o formulário
  // pela opção de reabrir com o template aprovado (mesmo padrão do NovaConversaDialog).
  const [foraDaJanela, setForaDaJanela] = useState(false)
  const [reabrindo, startReabrir] = useTransition()

  // Trocar de conversa reseta o fallback de janela — ajuste durante o render
  // (sem useEffect) para não disparar um re-render extra.
  const [conversaIdAnterior, setConversaIdAnterior] = useState(conversa.id)
  if (conversa.id !== conversaIdAnterior) {
    setConversaIdAnterior(conversa.id)
    setForaDaJanela(false)
  }

  function enviar() {
    const texto = resposta.trim()
    if (!texto || enviando) return
    startEnviar(async () => {
      const res = await responderConversa(conversa.id, texto)
      if (res.error) {
        if (res.foraDaJanela24h) { setForaDaJanela(true); return }
        toast.error(res.error)
        return
      }
      setResposta('')
      router.refresh()
    })
  }

  function reabrirComTemplate() {
    if (!conversa.wa_number) return
    startReabrir(async () => {
      const res = await reabrirConversaComTemplate(conversa.wa_number!, conversa.cliente_id ?? undefined)
      if (res.error) { toast.error(res.error); return }
      toast.success('Mensagem-modelo enviada. Assim que o cliente responder, dá pra conversar livremente.')
      setForaDaJanela(false)
      router.refresh()
    })
  }

  async function enviarAnexo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!MIME_MIDIA_ENVIO.includes(file.type)) {
      toast.error('Formato não suportado. Envie imagem (JPEG/PNG/WEBP), áudio (MP3/OGG) ou PDF.')
      e.target.value = ''
      return
    }
    if (file.size > TAMANHO_MAXIMO_MIDIA_BYTES) {
      toast.error('Arquivo muito grande. Limite de 4 MB.')
      e.target.value = ''
      return
    }

    setEnviandoAnexo(true)
    const formData = new FormData()
    formData.append('file', file)
    if (resposta.trim()) formData.append('legenda', resposta.trim())
    const res = await enviarMidiaConversa(conversa.id, formData)
    setEnviandoAnexo(false)
    e.target.value = ''

    if (res.error) { toast.error(res.error); return }
    setResposta('')
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          className="md:hidden flex items-center gap-1 text-sm text-muted-foreground"
          onClick={onVoltar}
        >
          <ArrowLeft className="size-4" /> Conversas
        </button>
        <div className="flex items-center gap-2">
          {conversa.cliente_id ? (
            <Link href={`/clientes/${conversa.cliente_id}`} className="text-sm font-semibold text-foreground hover:underline">
              {nomeOuNumero(conversa)}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-foreground">{nomeOuNumero(conversa)}</span>
          )}
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[status])}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!conversa.cliente_id && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setSalvandoContato(true)}>
              <UserPlus /> Salvar contato
            </Button>
          )}
          {status !== 'humano' && <Button size="sm" variant="outline" disabled={isPending} onClick={onAssumir}><User /> Assumir</Button>}
          {status !== 'bot' && <Button size="sm" variant="outline" disabled={isPending} onClick={onDevolver}><Bot /> Devolver ao bot</Button>}
          {status !== 'resolvido' && <Button size="sm" variant="outline" disabled={isPending} onClick={onResolver}><CornerUpLeft /> Resolver</Button>}
          {conversa.arquivada
            ? <Button size="sm" variant="outline" disabled={isPending} onClick={onArquivar}><ArchiveRestore /> Desarquivar</Button>
            : <Button size="sm" variant="outline" disabled={isPending} onClick={onArquivar}><Archive /> Arquivar</Button>}
          {(conversa.unread_count ?? 0) > 0 && <Button size="sm" variant="ghost" disabled={isPending} onClick={onMarcarLida}><CheckCheck /> Marcar lida</Button>}
        </div>
      </div>

      {salvandoContato && (
        <SalvarContatoForm
          conversa={conversa}
          clientesComTelefone={clientesComTelefone}
          onClose={() => setSalvandoContato(false)}
        />
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {mensagens.length === 0 ? (
          <div className="flex flex-1 items-center justify-center"><p className="text-sm text-muted-foreground">Nenhuma mensagem nesta conversa ainda.</p></div>
        ) : (
          mensagens.map((msg) => {
            const naDireita = msg.direction === 'out'
            const autor = msg.author_type ? AUTHOR_LABEL[msg.author_type] : 'Desconhecido'
            return (
              <div key={msg.id} className={cn('flex flex-col gap-1', naDireita ? 'items-end' : 'items-start')}>
                <span className="px-1 text-xs text-muted-foreground">{autor} · {formatarDataHora(msg.created_at)}</span>
                <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                  naDireita ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground')}>
                  <MidiaMensagem mediaUrl={msg.media_url} mediaMime={msg.media_mime} />
                  {msg.texto || (msg.media_mime ? '' : '(sem texto)')}
                  {naDireita && (
                    <div className="mt-1 flex justify-end">
                      <StatusEntrega status={msg.delivery_status} erro={msg.delivery_erro} />
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {foraDaJanela ? (
        <div className="flex flex-col gap-2 border-t border-border bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            Esse contato não fala com você há mais de 24h — o WhatsApp exige uma mensagem-modelo
            para reabrir contato. Ao confirmar, será enviada a <strong>mensagem padrão aprovada</strong>,
            não o texto digitado acima. Assim que ele responder, a conversa reabre e você volta a
            conversar livremente.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setForaDaJanela(false)} disabled={reabrindo}>
              <X /> Voltar
            </Button>
            <Button size="sm" onClick={reabrirComTemplate} disabled={reabrindo}>
              {reabrindo ? <Loader2 className="animate-spin" /> : <Send />} Reabrir conversa
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); enviar() }}
          className="flex items-end gap-2 border-t border-border px-4 py-3"
        >
          <input
            ref={anexoRef}
            type="file"
            accept={MIME_MIDIA_ENVIO.join(',')}
            onChange={enviarAnexo}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            disabled={enviando || enviandoAnexo}
            onClick={() => anexoRef.current?.click()}
            title="Anexar imagem, áudio ou PDF"
          >
            {enviandoAnexo ? <Loader2 className="animate-spin" /> : <Paperclip />}
          </Button>
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
            }}
            placeholder="Escreva uma mensagem..."
            rows={1}
            disabled={enviando}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 disabled:opacity-60"
          />
          <Button type="submit" disabled={enviando || !resposta.trim()}>
            {enviando ? <Loader2 className="animate-spin" /> : <Send />} Enviar
          </Button>
        </form>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Salvar contato — vincula quem está do outro lado da conversa a um Cliente:
// "Criar novo" (quick-create, o de sempre) ou "Vincular existente" (busca por
// nome e aponta pra um cadastro já feito, pra não duplicar — ver ADR do bug
// da Aislene: contato salvo sempre criava Cliente novo, mesmo já cadastrado).
// ---------------------------------------------------------------------------
function SalvarContatoForm({
  conversa,
  clientesComTelefone,
  onClose,
}: {
  conversa: Conversa
  clientesComTelefone: ClienteComTelefone[]
  onClose: () => void
}) {
  // Se o telefone da conversa já bate com um cliente cadastrado, sugere vincular
  // direto — é exatamente o caso que gerava duplicata (nomes diferentes, mesmo tel).
  const sugestao = conversa.wa_number
    ? clientesComTelefone.find((c) => ultimosDigitos(c.contato_telefone) === ultimosDigitos(conversa.wa_number!))
    : undefined
  const [modo, setModo] = useState<'criar' | 'vincular'>(sugestao ? 'vincular' : 'criar')

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-4 py-3">
      <div className="flex gap-1.5">
        <FiltroPill ativo={modo === 'criar'} onClick={() => setModo('criar')}>Criar novo</FiltroPill>
        <FiltroPill ativo={modo === 'vincular'} onClick={() => setModo('vincular')}>Vincular existente</FiltroPill>
      </div>
      {modo === 'criar' ? (
        <CriarContatoForm conversa={conversa} onClose={onClose} />
      ) : (
        <VincularClienteForm conversa={conversa} sugestao={sugestao} onClose={onClose} />
      )}
    </div>
  )
}

function CriarContatoForm({ conversa, onClose }: { conversa: Conversa; onClose: () => void }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState(conversa.wa_number ?? '')
  const [salvando, startSalvar] = useTransition()

  function salvar() {
    if (!nome.trim()) { toast.error('Informe o nome do contato.'); return }
    startSalvar(async () => {
      const res = await salvarContatoConversa(conversa.id, nome, telefone)
      if (res.error) { toast.error(res.error); return }
      toast.success('Contato salvo.')
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-1 flex-col gap-1 min-w-40">
        <label className="text-[11px] font-medium text-muted-foreground">Nome do contato</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Maria Silva"
          disabled={salvando}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-60"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 min-w-32">
        <label className="text-[11px] font-medium text-muted-foreground">Telefone</label>
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          disabled={salvando}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-60"
        />
      </div>
      <Button size="sm" onClick={salvar} disabled={salvando || !nome.trim()}>
        {salvando ? <Loader2 className="animate-spin" /> : <Check />} Salvar
      </Button>
      <Button size="sm" variant="outline" onClick={onClose} disabled={salvando}>
        <X /> Cancelar
      </Button>
    </div>
  )
}

interface ClienteBusca {
  id: string
  razao_social: string
  contato_telefone: string | null
}

function VincularClienteForm({
  conversa,
  sugestao,
  onClose,
}: {
  conversa: Conversa
  sugestao?: ClienteComTelefone
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<ClienteBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const [vinculando, startVincular] = useTransition()
  const [clienteId, setClienteId] = useState<string | null>(null)

  useEffect(() => {
    const termo = query.trim()
    if (termo.length < 2) return
    let cancelado = false
    const timer = setTimeout(() => {
      buscarClientesPorNome(termo)
        .then((dados) => { if (!cancelado) setResultados(dados) })
        .finally(() => { if (!cancelado) setBuscando(false) })
    }, 300)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [query])

  function onQueryChange(v: string) {
    setQuery(v)
    if (v.trim().length < 2) { setResultados([]); setBuscando(false) }
    else setBuscando(true) // já mostra "Buscando..." desde a digitação, não só quando o debounce dispara
  }

  function vincular(id: string) {
    setClienteId(id)
    startVincular(async () => {
      const res = await vincularClienteExistente(conversa.id, id)
      if (res.error) { toast.error(res.error); setClienteId(null); return }
      toast.success('Contato vinculado.')
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {sugestao && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">Mesmo telefone da conversa já cadastrado:</span>
            <span className="text-sm font-medium text-foreground">{sugestao.razao_social}</span>
          </div>
          <Button size="sm" onClick={() => vincular(sugestao.id)} disabled={vinculando}>
            {vinculando && clienteId === sugestao.id ? <Loader2 className="animate-spin" /> : <Check />} Vincular
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-1 min-w-40">
        <label className="text-[11px] font-medium text-muted-foreground">
          {sugestao ? 'Ou buscar outro cliente pelo nome' : 'Buscar cliente pelo nome'}
        </label>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Digite ao menos 2 letras..."
          disabled={vinculando}
          autoFocus={!sugestao}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-60"
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background">
          {buscando ? (
            <p className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Buscando...
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => vincular(c.id)}
                disabled={vinculando}
                className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted disabled:opacity-60"
              >
                <span className="truncate font-medium text-foreground">{c.razao_social}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {vinculando && clienteId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : c.contato_telefone}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onClose} disabled={vinculando}>
          <X /> Cancelar
        </Button>
      </div>
    </div>
  )
}
