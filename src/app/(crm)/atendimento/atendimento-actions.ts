'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthUser, getAuthAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCliente } from '../clientes/actions'
import { enviarMensagemWhatsApp, enviarTemplateWhatsApp } from '@/lib/whatsapp-cloud'

/**
 * Server actions do inbox de Atendimento (conversas do SDR / WhatsApp).
 *
 * `conversations` e `messages` NÃO têm RLS (deny-all p/ client de usuário), então
 * escrevemos via admin client (service_role). A autorização + isolamento de tenant
 * são garantidos aqui: resolvemos a empresa do usuário e filtramos por empresa_id.
 */
async function authEmpresa(): Promise<{ empresaId: string; userId: string }> {
  // Tenant EFETIVO: para platform admin é empresa_ativa_id; p/ usuário comum é empresa_id.
  // (Não reler profiles.empresa_id direto: daria vazio/órfão p/ platform admin.)
  const { empresaId, role, user } = await getAuthUser()
  if (role === 'parceiro') throw new Error('Acesso negado.')
  if (!empresaId) redirect('/login')
  return { empresaId, userId: user.id }
}

/** Humano assume a conversa: status=humano e o bot cala (ia_ativa=false). */
export async function assumirConversa(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'humano', ia_ativa: false })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Devolve ao bot: status=bot e a IA volta a responder (ia_ativa=true). */
export async function devolverAoBot(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'bot', ia_ativa: true })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Marca a conversa como resolvida. */
export async function resolverConversa(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ status: 'resolvido' })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Arquiva a conversa: sai da lista principal e vai pra aba "Arquivadas".
 *  Não toca no `status` (que pertence ao fluxo do bot) — é só organização. */
export async function arquivarConversa(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ arquivada: true })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Tira a conversa da aba "Arquivadas" e devolve pra lista principal. */
export async function desarquivarConversa(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ arquivada: false })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/** Zera o contador de não lidas da conversa. */
export async function marcarLida(id: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { error } = await admin
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }
  revalidatePath('/atendimento')
  return {}
}

/**
 * Nº de conversas da empresa com `unread_count > 0` — usado pro badge de não
 * lidas no item "WhatsApp" da sidebar (fetch inicial no layout + polling no
 * client). `{ count: 'exact', head: true }` traz só o número, sem linhas.
 *
 * Em erro de query, LANÇA (em vez de devolver 0): quem chama no client faz
 * polling e precisa distinguir "falhou, mantenha o valor anterior" de
 * "de fato zero conversas não lidas" — devolver 0 aqui zeraria o badge à toa
 * numa falha transitória. O fetch inicial no layout trata essa exceção com
 * fallback pra 0 (não pode derrubar a página inteira).
 */
export async function contarConversasNaoLidas(): Promise<number> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { count, error } = await admin
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .gt('unread_count', 0)
  if (error) {
    console.error('[atendimento] erro ao contar conversas não lidas:', error.message)
    throw new Error(error.message)
  }
  return count ?? 0
}

/**
 * Salva o número do WhatsApp do atendimento (vira o número do robô para esta
 * empresa). Deve ser o MESMO número liberado na WhatsApp Cloud API da Meta.
 */
export async function salvarNumeroAtendimento(numero: string): Promise<{ error?: string }> {
  // Apenas admins podem alterar o número do WhatsApp da empresa.
  let empresaId: string
  try {
    const auth = await getAuthAdmin()
    if (!auth.empresaId) return { error: 'Sua conta não está vinculada a uma empresa.' }
    empresaId = auth.empresaId
  } catch {
    return { error: 'Apenas administradores podem alterar o número do WhatsApp.' }
  }
  const num = numero?.trim()
  if (!num) return { error: 'Informe o número do WhatsApp.' }

  const admin = createAdminClient()
  const { data: existente } = await admin
    .from('clientes_sdr')
    .select('id')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  const { error } = existente?.id
    ? await admin.from('clientes_sdr').update({ wa_phone_number_id: num, updated_at: new Date().toISOString() }).eq('id', existente.id)
    : await admin.from('clientes_sdr').insert({ empresa_id: empresaId, wa_phone_number_id: num, nome_assistente: 'Leila' })

  if (error) {
    if (error.code === '23505') return { error: 'Esse número já está vinculado a outra conta.' }
    return { error: error.message }
  }
  revalidatePath('/atendimento')
  return {}
}

/**
 * Envia uma resposta pelo WhatsApp numa conversa existente.
 *
 * O envio de verdade acontece no app-sdr (dono das credenciais da Cloud API) via
 * `POST /api/chat/conversas/[id]/enviar` — esta action só valida que a conversa é
 * desta empresa e repassa a chamada, autenticada por SDR_CHAT_API_KEY (nunca exposta
 * ao client). O app-sdr já cuida de gravar a mensagem e mudar o status para 'humano'.
 */
export async function responderConversa(id: string, texto: string): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const msg = texto?.trim()
  if (!msg) return { error: 'Digite uma mensagem.' }

  const admin = createAdminClient()
  const { data: conv } = await admin
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!conv) return { error: 'Acesso negado.' }

  const url = process.env.SDR_CHAT_API_URL
  const key = process.env.SDR_CHAT_API_KEY
  if (!url || !key) return { error: 'Integração de envio não configurada.' }

  try {
    const res = await fetch(`${url}/api/chat/conversas/${id}/enviar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: msg }),
    })
    if (!res.ok) {
      const corpo = await res.text().catch(() => '')
      return { error: `Falha ao enviar a mensagem (${res.status}). ${corpo}`.trim() }
    }
  } catch {
    return { error: 'Não foi possível enviar a mensagem agora. Tente de novo.' }
  }

  revalidatePath('/atendimento')
  return {}
}

/**
 * Salva quem está do outro lado de uma conversa como um Cliente (quick-create:
 * nome + telefone, o resto fica em branco pra completar depois em /clientes).
 * Reaproveita createCliente() — não duplica a lógica de insert/empresa_id/RLS.
 */
export async function salvarContatoConversa(
  conversaId: string,
  nome: string,
  telefone: string,
): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const nomeAparado = nome?.trim()
  if (!nomeAparado) return { error: 'Informe o nome do contato.' }

  const admin = createAdminClient()
  const { data: conv } = await admin
    .from('conversations')
    .select('id')
    .eq('id', conversaId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!conv) return { error: 'Acesso negado.' }

  const formData = new FormData()
  formData.set('razao_social', nomeAparado)
  formData.set('tipo_pessoa', 'pf')
  formData.set('contato_telefone', telefone?.trim() ?? '')

  const resultado = await createCliente(formData)
  if (resultado.error || !resultado.cliente) {
    return { error: resultado.error ?? 'Falha ao salvar o contato.' }
  }

  const { error } = await admin
    .from('conversations')
    .update({ cliente_id: resultado.cliente.id })
    .eq('id', conversaId)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }

  revalidatePath('/atendimento')
  return {}
}

/**
 * Vincula a conversa a um Cliente JÁ EXISTENTE (sem criar nada) — usar quando quem
 * está conversando já tem cadastro completo, pra não duplicar (ver buscarClientesPorNome).
 */
export async function vincularClienteExistente(
  conversaId: string,
  clienteId: string,
): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()
  const id = clienteId?.trim()
  if (!id) return { error: 'Selecione um cliente.' }

  const admin = createAdminClient()

  const { data: conv } = await admin
    .from('conversations')
    .select('id')
    .eq('id', conversaId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!conv) return { error: 'Acesso negado.' }

  const { data: cliente } = await admin
    .from('clientes')
    .select('id')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!cliente) return { error: 'Cliente não encontrado.' }

  const { error } = await admin
    .from('conversations')
    .update({ cliente_id: cliente.id })
    .eq('id', conversaId)
    .eq('empresa_id', empresaId)
  if (error) return { error: error.message }

  revalidatePath('/atendimento')
  return {}
}

/** Remove acentos e baixa a caixa — "José" e "jose" precisam casar na busca. */
function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Últimos 8 dígitos de um telefone, sem formatação. Números BR variam em como
 * armazenam DDI (55) e o 9º dígito do celular — mas os 8 dígitos finais (o
 * número "puro", sem DDD) são estáveis entre os formatos. Usado pra casar
 * "(71)98858-5066" com "557188585066" (mesma linha, formatos diferentes).
 */
function ultimosDigitos(tel: string): string {
  const digitos = tel.replace(/\D/g, '')
  return digitos.slice(-8)
}

/**
 * Busca clientes da empresa pelo nome (razão social ou nome do contato) ou telefone,
 * pra oferecer "vincular a um cadastro existente" em vez de criar um Cliente duplicado.
 *
 * Feito em memória (não via `ilike` do Postgres) por dois motivos: `ilike` não ignora
 * acento — "jose" não acharia "José", o que é a forma mais comum de digitar no Brasil
 * e recriaria o próprio bug que esta função existe pra evitar — e assim também dá pra
 * casar por telefone (formatos de máscara variam) na mesma busca, sem duas queries.
 */
export async function buscarClientesPorNome(
  query: string,
): Promise<{ id: string; razao_social: string; contato_telefone: string | null }[]> {
  const termo = query?.trim()
  if (!termo || termo.length < 2) return []

  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('clientes')
    .select('id, razao_social, contato_nome, contato_telefone')
    .eq('empresa_id', empresaId)
    .order('razao_social')

  if (error) {
    console.error('[atendimento] erro ao buscar clientes por nome:', error.message)
    return []
  }

  type Linha = { id: string; razao_social: string; contato_nome: string | null; contato_telefone: string | null }
  const termoNorm = normalizarTexto(termo)
  const termoDigitos = termo.replace(/\D/g, '')

  const encontrados = ((data ?? []) as Linha[]).filter((c) => {
    const casaNome =
      normalizarTexto(c.razao_social).includes(termoNorm) ||
      (c.contato_nome ? normalizarTexto(c.contato_nome).includes(termoNorm) : false)
    const casaTelefone =
      termoDigitos.length >= 4 && c.contato_telefone
        ? ultimosDigitos(c.contato_telefone).includes(termoDigitos.slice(-8))
        : false
    return casaNome || casaTelefone
  })

  return encontrados.slice(0, 10).map(({ id, razao_social, contato_telefone }) => ({ id, razao_social, contato_telefone }))
}

/** Lista os clientes da empresa com telefone cadastrado, pra escolher ao iniciar uma conversa. */
export async function listarClientesComTelefone(): Promise<
  { id: string; razao_social: string; contato_telefone: string }[]
> {
  const { empresaId } = await authEmpresa()
  const admin = createAdminClient()
  const { data } = await admin
    .from('clientes')
    .select('id, razao_social, contato_telefone')
    .eq('empresa_id', empresaId)
    .not('contato_telefone', 'is', null)
    .order('razao_social')
  return (data ?? []) as { id: string; razao_social: string; contato_telefone: string }[]
}

/**
 * Cria (ou reusa, casando por `wa_number`) a conversa desta empresa para
 * `num`, vinculando a `clienteId` quando informado (confirmando antes que é
 * desta empresa, pra não gravar cliente_id de outro tenant a partir de um UUID
 * arbitrário). Extraído de `iniciarConversa` — é o mesmo passo inicial de
 * `reabrirConversaComTemplate`, só muda o que é enviado depois.
 */
async function criarOuReusarConversa(
  empresaId: string,
  admin: ReturnType<typeof createAdminClient>,
  num: string,
  clienteId?: string,
): Promise<{ error?: string; id?: string }> {
  let clienteIdValido: string | null = null
  if (clienteId) {
    const { data: cliente } = await admin
      .from('clientes')
      .select('id')
      .eq('id', clienteId)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    clienteIdValido = cliente?.id ?? null
  }

  const { data: existe } = await admin
    .from('conversations')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('wa_number', num)
    .maybeSingle()

  let convId = existe?.id
  if (!convId) {
    const { data: nova, error } = await admin
      .from('conversations')
      .insert({
        empresa_id: empresaId,
        wa_number: num,
        status: 'humano',
        ia_ativa: false,
        etapa: 'abertura',
        last_inbound_at: new Date().toISOString(),
        cliente_id: clienteIdValido,
      })
      .select('id')
      .single()
    if (error || !nova) return { error: error?.message ?? 'Falha ao iniciar a conversa.' }
    convId = nova.id
  } else if (clienteIdValido) {
    await admin.from('conversations').update({ cliente_id: clienteIdValido }).eq('id', convId)
  }

  return { id: convId }
}

/**
 * Inicia uma conversa manualmente (humano inicia — não o robô). Cria/reusa a
 * conversa pelo número, envia a 1ª mensagem de verdade pelo WhatsApp Cloud API
 * (nº2, chat humano — ver src/lib/whatsapp-cloud.ts) e registra o resultado.
 *
 * Fora da janela de 24h desde a última mensagem do cliente, a Meta rejeita
 * envio de texto livre (exige template aprovado) — nesse caso a conversa/
 * mensagem ainda ficam registradas (delivery_status='failed'), devolvemos um
 * erro explicando a janela, e `foraDaJanela24h: true` (estruturado, além do
 * texto) pra UI oferecer "Reabrir conversa" (reabrirConversaComTemplate) em
 * vez de só um toast genérico.
 */
export async function iniciarConversa(
  numero: string,
  mensagem: string,
  clienteId?: string,
): Promise<{ error?: string; id?: string; foraDaJanela24h?: boolean }> {
  const { empresaId } = await authEmpresa()
  const num = numero?.replace(/\D/g, '')
  if (!num || num.length < 10) return { error: 'Número inválido (use DDD + número).' }
  const msg = mensagem?.trim()

  const admin = createAdminClient()
  const conv = await criarOuReusarConversa(empresaId, admin, num, clienteId)
  if (conv.error || !conv.id) return { error: conv.error ?? 'Falha ao iniciar a conversa.' }
  const convId = conv.id

  if (msg) {
    const envio = await enviarMensagemWhatsApp(num, msg)

    const { error: msgErr } = await admin.from('messages').insert({
      conversation_id: convId,
      direction: 'out',
      author_type: 'humano',
      texto: msg,
      delivery_status: envio.ok ? 'sent' : 'failed',
      wa_message_id: envio.ok ? envio.messageId : null,
      payload: envio.ok ? null : { erro: envio.erro },
    })
    if (msgErr) return { error: `Conversa criada, mas falhou ao registrar a mensagem: ${msgErr.message}`, id: convId }
    if (!envio.ok) return { error: envio.erro, id: convId, foraDaJanela24h: envio.foraDaJanela24h }
  }

  revalidatePath('/atendimento')
  return { id: convId }
}

/**
 * Reabre contato fora da janela de 24h enviando o template aprovado pela Meta
 * (`retomar_atendimento`) em vez de texto livre — a Graph API rejeita texto
 * livre nesse caso (ver iniciarConversa/foraDaJanela24h). Cria/reusa a
 * conversa igual iniciarConversa (criarOuReusarConversa) e grava a mensagem
 * enviada (texto renderizado do template, não o que o usuário digitaria numa
 * mensagem livre — aqui não há campo de mensagem livre, é sempre o template).
 *
 * Nome do cliente ({{1}} do template): `clientes.razao_social` quando
 * `clienteId` foi passado e pertence a esta empresa; senão "Cliente" (sem
 * cadastro vinculado ainda, ex.: número novo). Nome do atendente ({{2}}):
 * nome do usuário logado + ", da " + nome da empresa/tenant.
 */
export async function reabrirConversaComTemplate(
  numero: string,
  clienteId?: string,
): Promise<{ error?: string; id?: string }> {
  const { empresaId, userId } = await authEmpresa()
  const num = numero?.replace(/\D/g, '')
  if (!num || num.length < 10) return { error: 'Número inválido (use DDD + número).' }

  const admin = createAdminClient()
  const conv = await criarOuReusarConversa(empresaId, admin, num, clienteId)
  if (conv.error || !conv.id) return { error: conv.error ?? 'Falha ao iniciar a conversa.' }
  const convId = conv.id

  let nomeCliente = 'Cliente'
  if (clienteId) {
    const { data: cliente } = await admin
      .from('clientes')
      .select('razao_social')
      .eq('id', clienteId)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (cliente?.razao_social) nomeCliente = cliente.razao_social
  }

  const [{ data: profile }, { data: empresa }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    admin.from('empresas').select('nome').eq('id', empresaId).maybeSingle(),
  ])
  const nomeAtendente = `${profile?.full_name ?? 'Atendente'}, da ${empresa?.nome ?? 'nossa empresa'}`

  const envio = await enviarTemplateWhatsApp(num, nomeCliente, nomeAtendente)

  const { error: msgErr } = await admin.from('messages').insert({
    conversation_id: convId,
    direction: 'out',
    author_type: 'humano',
    texto: `Olá ${nomeCliente}, aqui é ${nomeAtendente}. Estamos entrando em contato para dar continuidade ao seu atendimento. Pode responder esta mensagem quando for possível.`,
    delivery_status: envio.ok ? 'sent' : 'failed',
    wa_message_id: envio.ok ? envio.messageId : null,
    payload: envio.ok ? null : { erro: envio.erro },
  })
  if (msgErr) return { error: `Conversa criada, mas falhou ao registrar a mensagem: ${msgErr.message}`, id: convId }
  if (!envio.ok) return { error: envio.erro, id: convId }

  revalidatePath('/atendimento')
  return { id: convId }
}
