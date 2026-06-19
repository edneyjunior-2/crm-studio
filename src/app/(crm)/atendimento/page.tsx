import { getAuthUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Inbox, type Conversa, type Mensagem } from './inbox'

/**
 * Aba Atendimento — inbox de conversas do WhatsApp do SDR (robô Leila).
 *
 * As tabelas `conversations` e `messages` NÃO têm RLS (deny-all para o client
 * de usuário comum). Por isso lemos via admin client (service_role). A rota é
 * protegida por getAuthUser (redirect /login se não autenticado).
 *
 * Multi-tenant: filtra as conversas por `empresa_id` (a agenda do SDR carimba a
 * empresa via phone_number_id). Cada tenant vê só as conversas dele.
 */
export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { empresaId } = await getAuthUser() // redireciona para /login se não autenticado
  const { c: selecionadaId } = await searchParams

  const admin = createAdminClient()

  // Número do WhatsApp configurado p/ esta empresa (atendimento/robô)
  const { data: cfgSdr } = await admin
    .from('clientes_sdr')
    .select('wa_phone_number_id')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  const numeroAtendimento = cfgSdr?.wa_phone_number_id ?? null

  // Conversas DESTA empresa, mais recentes primeiro (last_inbound_at, fallback updated_at).
  const { data: conversas, error: convErr } = await admin
    .from('conversations')
    .select(
      'id, wa_number, etapa, ia_ativa, encaminhado, status, assignee_id, last_inbound_at, unread_count, snooze_until, labels, created_at, updated_at'
    )
    .eq('empresa_id', empresaId)
    .order('last_inbound_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(100)

  if (convErr) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Atendimento</h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm text-destructive">
            Erro ao carregar as conversas. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    )
  }

  const listaConversas = (conversas ?? []) as Conversa[]

  // Conversa selecionada e suas mensagens (ordem cronológica).
  const selecionada =
    listaConversas.find((conv) => conv.id === selecionadaId) ?? null

  let mensagens: Mensagem[] = []
  if (selecionada) {
    const { data: msgs } = await admin
      .from('messages')
      .select(
        'id, conversation_id, direction, texto, author_type, delivery_status, media_url, media_mime, created_at'
      )
      .eq('conversation_id', selecionada.id)
      .order('created_at', { ascending: true })

    mensagens = (msgs ?? []) as Mensagem[]
  }

  return (
    <Inbox
      conversas={listaConversas}
      selecionada={selecionada}
      mensagens={mensagens}
      numeroAtendimento={numeroAtendimento}
    />
  )
}
