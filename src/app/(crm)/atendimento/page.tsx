import { getAuthUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Inbox, type Conversa, type Mensagem } from './inbox'
import { buscarMensagensConversa, listarClientesComTelefone, listarTemplatesWhatsAppAtivos } from './atendimento-actions'

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

  // Conversas DESTA empresa, mais recentes primeiro (last_inbound_at, fallback updated_at).
  const { data: conversas, error: convErr } = await admin
    .from('conversations')
    .select(
      'id, wa_number, etapa, ia_ativa, encaminhado, status, assignee_id, last_inbound_at, unread_count, snooze_until, labels, arquivada, created_at, updated_at, cliente_id, clientes(razao_social)'
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

  // O embed `clientes(razao_social)` é to-one (via conversations.cliente_id), mas o
  // supabase-js infere array por padrão sem tipos gerados — objeto de verdade em runtime.
  const listaConversas = (conversas ?? []) as unknown as Conversa[]

  // Conversa selecionada e suas mensagens (ordem cronológica).
  const selecionada =
    listaConversas.find((conv) => conv.id === selecionadaId) ?? null

  // Mesma query + assinatura de mídia usada pelo polling do Thread (evita duas
  // fontes da verdade pro mesmo SELECT) — ver `buscarMensagensConversa`.
  const mensagens: Mensagem[] = selecionada ? await buscarMensagensConversa(selecionada.id) : []

  const [clientesComTelefone, templatesWhatsApp] = await Promise.all([
    listarClientesComTelefone(),
    listarTemplatesWhatsAppAtivos(),
  ])

  return (
    <Inbox
      conversas={listaConversas}
      selecionada={selecionada}
      mensagens={mensagens}
      clientesComTelefone={clientesComTelefone}
      templatesWhatsApp={templatesWhatsApp}
    />
  )
}
