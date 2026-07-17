'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MessagesSquare, Bot, User, CheckCheck, CornerUpLeft,
  Search, Plus, Smartphone, Pencil, Check, X, Loader2, ArrowLeft, Send, UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select'
import {
  assumirConversa, devolverAoBot, resolverConversa, marcarLida,
  salvarNumeroAtendimento, iniciarConversa, responderConversa, salvarContatoConversa,
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

export interface Mensagem {
  id: string
  conversation_id: string | null
  direction: 'in' | 'out' | null
  texto: string | null
  author_type: 'lead' | 'bot' | 'humano' | 'sistema' | null
  delivery_status: string | null
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
  numeroAtendimento: string | null
  clientesComTelefone: ClienteComTelefone[]
}

export function Inbox({ conversas, selecionada, mensagens, numeroAtendimento, clientesComTelefone }: InboxProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas'>('todas')
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
    if (filtro === 'nao_lidas' && (c.unread_count ?? 0) === 0) return false
    if (termo && !(c.wa_number ?? '').toLowerCase().includes(termo)) return false
    return true
  })
  const naoLidasTotal = conversas.filter((c) => (c.unread_count ?? 0) > 0).length

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

      {/* Configuração do número do atendimento */}
      <NumeroAtendimento numero={numeroAtendimento} />

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
              onVoltar={() => setMobileView('lista')}
              onAssumir={() => executar(assumirConversa, selecionada.id, 'Conversa assumida.')}
              onDevolver={() => executar(devolverAoBot, selecionada.id, 'Conversa devolvida ao bot.')}
              onResolver={() => executar(resolverConversa, selecionada.id, 'Conversa resolvida.')}
              onMarcarLida={() => executar(marcarLida, selecionada.id, 'Marcada como lida.')}
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
// Configuração do número do atendimento (cliente define; é o número da Meta)
// ---------------------------------------------------------------------------
function NumeroAtendimento({ numero }: { numero: string | null }) {
  const router = useRouter()
  const [editando, setEditando] = useState(!numero)
  const [valor, setValor] = useState(numero ?? '')
  const [salvando, startSalvar] = useTransition()

  function salvar() {
    if (!valor.trim()) { toast.error('Informe o número do WhatsApp.'); return }
    startSalvar(async () => {
      const res = await salvarNumeroAtendimento(valor.trim())
      if (res.error) { toast.error(res.error); return }
      toast.success('Número salvo.')
      setEditando(false)
      router.refresh()
    })
  }

  if (!editando && numero) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <Smartphone className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Número do atendimento:</span>
          <span className="font-medium text-foreground">{numero}</span>
        </div>
        <button onClick={() => setEditando(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Pencil className="size-3.5" /> Editar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-amber-700 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Número do WhatsApp do atendimento</p>
      </div>
      <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400/90">
        Informe o número que o robô (Leila) vai usar para atender. Ele precisa ser o <strong>mesmo número
        liberado na sua conta WhatsApp Business API (Meta)</strong> — é por ele que as conversas chegam aqui.
      </p>
      <div className="mt-1 flex items-center gap-2">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Ex.: 5571999998888 (ou o phone_number_id da Meta)"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="animate-spin" /> : <Check />} Salvar
        </Button>
        {numero && (
          <Button variant="outline" onClick={() => { setEditando(false); setValor(numero) }} disabled={salvando}>
            <X /> Cancelar
          </Button>
        )}
      </div>
    </div>
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

  function escolherCliente(id: string | undefined) {
    setClienteId(id)
    const cliente = clientes.find((c) => c.id === id)
    if (cliente) setNumero(cliente.contato_telefone)
  }

  function iniciar() {
    if (!numero.trim()) { toast.error('Informe o número.'); return }
    startEnviar(async () => {
      const res = await iniciarConversa(numero, mensagem, clienteId)
      if (res.error) { toast.error(res.error); return }
      toast.success('Conversa criada.')
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
          <p className="text-[11px] text-muted-foreground">
            Essa primeira mensagem fica registrada, mas o envio pelo WhatsApp ainda não acontece aqui — depois de criar,
            abra a conversa e responda por lá para enviar de verdade.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
            <Button onClick={iniciar} disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" /> : <Plus />} Iniciar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ThreadProps {
  conversa: Conversa
  mensagens: Mensagem[]
  isPending: boolean
  onVoltar: () => void
  onAssumir: () => void
  onDevolver: () => void
  onResolver: () => void
  onMarcarLida: () => void
}

function Thread({ conversa, mensagens, isPending, onVoltar, onAssumir, onDevolver, onResolver, onMarcarLida }: ThreadProps) {
  const router = useRouter()
  const status = conversa.status ?? 'bot'
  const [resposta, setResposta] = useState('')
  const [enviando, startEnviar] = useTransition()
  const [salvandoContato, setSalvandoContato] = useState(false)

  function enviar() {
    const texto = resposta.trim()
    if (!texto || enviando) return
    startEnviar(async () => {
      const res = await responderConversa(conversa.id, texto)
      if (res.error) { toast.error(res.error); return }
      setResposta('')
      router.refresh()
    })
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
          {(conversa.unread_count ?? 0) > 0 && <Button size="sm" variant="ghost" disabled={isPending} onClick={onMarcarLida}><CheckCheck /> Marcar lida</Button>}
        </div>
      </div>

      {salvandoContato && (
        <SalvarContatoForm
          conversa={conversa}
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
                  {msg.media_url && (
                    <a href={msg.media_url} target="_blank" rel="noreferrer" className="mb-1 block underline underline-offset-2 opacity-90">
                      {msg.media_mime?.startsWith('image/') ? 'Ver imagem' : 'Ver anexo'}
                    </a>
                  )}
                  {msg.texto || (msg.media_url ? '' : '(sem texto)')}
                </div>
              </div>
            )
          })
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); enviar() }}
        className="flex items-end gap-2 border-t border-border px-4 py-3"
      >
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
    </>
  )
}

// ---------------------------------------------------------------------------
// Salvar contato — cria um Cliente (quick-create) a partir de quem está
// conversando, pra completar o cadastro depois em /clientes.
// ---------------------------------------------------------------------------
function SalvarContatoForm({ conversa, onClose }: { conversa: Conversa; onClose: () => void }) {
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
    <div className="flex flex-wrap items-end gap-2 border-b border-border bg-muted/40 px-4 py-3">
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
