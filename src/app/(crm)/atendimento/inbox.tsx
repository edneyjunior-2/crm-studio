'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MessagesSquare,
  Bot,
  User,
  CheckCheck,
  CornerUpLeft,
  Clock,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  assumirConversa,
  devolverAoBot,
  resolverConversa,
  marcarLida,
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

const STATUS_LABEL: Record<Status, string> = {
  bot: 'Bot',
  humano: 'Humano',
  resolvido: 'Resolvido',
  adiado: 'Adiado',
}

// Badges: bot=azul, humano=âmbar, resolvido=verde, adiado=cinza.
const STATUS_BADGE: Record<Status, string> = {
  bot: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  humano: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  resolvido: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  adiado: 'bg-muted text-muted-foreground',
}

/** Formata um timestamp para pt-BR. Hoje → só hora; outros dias → data curta. */
function formatarHorario(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const agora = new Date()
  const mesmoDia =
    d.getFullYear() === agora.getFullYear() &&
    d.getMonth() === agora.getMonth() &&
    d.getDate() === agora.getDate()
  if (mesmoDia) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Formata data + hora completas (cabeçalho de mensagem). */
function formatarDataHora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const AUTHOR_LABEL: Record<NonNullable<Mensagem['author_type']>, string> = {
  lead: 'Lead',
  bot: 'Leila (bot)',
  humano: 'Atendente',
  sistema: 'Sistema',
}

interface InboxProps {
  conversas: Conversa[]
  selecionada: Conversa | null
  mensagens: Mensagem[]
}

export function Inbox({ conversas, selecionada, mensagens }: InboxProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function executar(
    fn: (id: string) => Promise<{ error?: string }>,
    id: string,
    sucesso: string
  ) {
    startTransition(async () => {
      const res = await fn(id)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(sucesso)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atendimento</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Conversas do WhatsApp atendidas pelo SDR (robô Leila).
        </p>
      </div>

      {conversas.length === 0 ? (
        <EstadoVazio />
      ) : (
        <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-xl border border-border bg-card">
          {/* Lista de conversas (esquerda) */}
          <div className="flex w-full max-w-xs shrink-0 flex-col overflow-y-auto border-r border-border md:max-w-sm">
            {conversas.map((conv) => {
              const ativa = conv.id === selecionada?.id
              const status = conv.status ?? 'bot'
              const naoLidas = conv.unread_count ?? 0
              return (
                <Link
                  key={conv.id}
                  href={`/atendimento?c=${conv.id}`}
                  className={cn(
                    'flex flex-col gap-1 border-b border-border px-3 py-2.5 transition-colors hover:bg-muted/60',
                    ativa && 'bg-muted'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {conv.wa_number ?? 'Sem número'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatarHorario(conv.last_inbound_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_BADGE[status]
                      )}
                    >
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
            })}
          </div>

          {/* Thread (direita) */}
          <div className="flex min-w-0 flex-1 flex-col">
            {selecionada ? (
              <Thread
                conversa={selecionada}
                mensagens={mensagens}
                isPending={isPending}
                onAssumir={() =>
                  executar(assumirConversa, selecionada.id, 'Conversa assumida.')
                }
                onDevolver={() =>
                  executar(devolverAoBot, selecionada.id, 'Conversa devolvida ao bot.')
                }
                onResolver={() =>
                  executar(resolverConversa, selecionada.id, 'Conversa resolvida.')
                }
                onMarcarLida={() =>
                  executar(marcarLida, selecionada.id, 'Marcada como lida.')
                }
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <MessagesSquare className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Selecione uma conversa à esquerda para ver as mensagens.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface ThreadProps {
  conversa: Conversa
  mensagens: Mensagem[]
  isPending: boolean
  onAssumir: () => void
  onDevolver: () => void
  onResolver: () => void
  onMarcarLida: () => void
}

function Thread({
  conversa,
  mensagens,
  isPending,
  onAssumir,
  onDevolver,
  onResolver,
  onMarcarLida,
}: ThreadProps) {
  const status = conversa.status ?? 'bot'

  return (
    <>
      {/* Cabeçalho da thread */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {conversa.wa_number ?? 'Sem número'}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_BADGE[status]
            )}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {status !== 'humano' && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={onAssumir}>
              <User /> Assumir
            </Button>
          )}
          {status !== 'bot' && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={onDevolver}>
              <Bot /> Devolver ao bot
            </Button>
          )}
          {status !== 'resolvido' && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={onResolver}>
              <CornerUpLeft /> Resolver
            </Button>
          )}
          {(conversa.unread_count ?? 0) > 0 && (
            <Button size="sm" variant="ghost" disabled={isPending} onClick={onMarcarLida}>
              <CheckCheck /> Marcar lida
            </Button>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {mensagens.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem nesta conversa ainda.
            </p>
          </div>
        ) : (
          mensagens.map((msg) => {
            // Lead (entrada) à esquerda; bot/humano/sistema (saída) à direita.
            const naDireita = msg.direction === 'out'
            const autor = msg.author_type ? AUTHOR_LABEL[msg.author_type] : 'Desconhecido'
            return (
              <div
                key={msg.id}
                className={cn('flex flex-col gap-1', naDireita ? 'items-end' : 'items-start')}
              >
                <span className="px-1 text-xs text-muted-foreground">
                  {autor} · {formatarDataHora(msg.created_at)}
                </span>
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                    naDireita
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm bg-muted text-foreground'
                  )}
                >
                  {msg.media_url && (
                    <a
                      href={msg.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-1 block underline underline-offset-2 opacity-90"
                    >
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

      {/* Aviso no lugar do campo de resposta.
          TODO: implementar envio de mensagem ao lead quando o número de WhatsApp
          do cliente estiver conectado (provedor/Z-API/Cloud API). Exige número
          real + roteamento de saída; fora de escopo nesta entrega. */}
      <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" />
        <span>
          Responder pelo WhatsApp estará disponível quando o número do cliente estiver conectado.
        </span>
      </div>
    </>
  )
}

function EstadoVazio() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Clock className="size-7 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Nenhuma conversa ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          As conversas do WhatsApp (SDR) aparecerão aqui.
        </p>
      </div>
    </div>
  )
}
