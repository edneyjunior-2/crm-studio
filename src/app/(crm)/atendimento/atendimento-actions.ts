'use server'

import { revalidatePath, unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthUser, getAuthAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCliente } from '../clientes/actions'
import {
  enviarMensagemWhatsApp, enviarTemplateWhatsApp, marcarMensagemComoLidaWhatsApp,
  uploadMidiaWhatsApp, enviarMidiaWhatsApp, listarTemplatesWhatsApp,
  type TipoMidiaWhatsApp, type WhatsAppTemplateInfo,
} from '@/lib/whatsapp-cloud'

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

/**
 * Marca como respondidas as mensagens do lead ainda pendentes nesta conversa —
 * chamar sempre que um HUMANO manda algo com sucesso pra ela. Sem isso, o
 * sensor `leila-buraco-negro` (src/lib/monitoramento.ts) ficava crítico pra
 * sempre numa conversa já resolvida manualmente: só o bot marcava
 * `respondida=true`, nunca o humano (achado da auditoria de monitoramento de
 * 2026-07-22). Best-effort: erro aqui não pode derrubar o envio da mensagem.
 */
async function marcarMensagensRespondidas(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
): Promise<void> {
  const { error } = await admin
    .from('messages')
    .update({ respondida: true })
    .eq('conversation_id', conversationId)
    .eq('direction', 'in')
    .eq('author_type', 'lead')
    .eq('respondida', false)
  if (error) console.error('[atendimento] erro ao marcar mensagens como respondidas:', error.message)
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

  // Leitura real no WhatsApp do cliente (✓✓ azul) — best-effort: a última
  // mensagem inbound é marcada como lida na Meta. Falha aqui NUNCA derruba a
  // action — zerar unread_count (acima) já é o efeito que importa pro CRM.
  const { data: ultimaInbound } = await admin
    .from('messages')
    .select('wa_message_id')
    .eq('conversation_id', id)
    .eq('direction', 'in')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (ultimaInbound?.wa_message_id) {
    await marcarMensagemComoLidaWhatsApp(ultimaInbound.wa_message_id).catch(() => {})
  }

  revalidatePath('/atendimento')
  return {}
}

const MIMES_MIDIA_ENVIO: Record<string, TipoMidiaWhatsApp> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'audio/mpeg': 'audio',
  'audio/ogg': 'audio',
  'audio/mp4': 'audio',
  'application/pdf': 'document',
}
const TAMANHO_MAXIMO_MIDIA_BYTES = 4 * 1024 * 1024

/**
 * Envia uma mídia (imagem/áudio/documento) pra conversa, direto pra Graph API
 * da Meta (não passa pelo app-sdr — ver spec atendimento-paridade-whatsapp.md
 * sobre por quê). Sobe o mesmo arquivo pro bucket privado `whatsapp-media`
 * pra ter uma URL própria de exibir no inbox (a URL da Meta expira e exige
 * header de auth, não dá pra usar direto num <img src>).
 */
export async function enviarMidiaConversa(
  conversationId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { empresaId } = await authEmpresa()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Selecione um arquivo para enviar.' }
  const tipo = MIMES_MIDIA_ENVIO[file.type]
  if (!tipo) return { error: 'Formato não suportado. Envie imagem (JPEG/PNG/WEBP), áudio (MP3/OGG) ou PDF.' }
  if (file.size > TAMANHO_MAXIMO_MIDIA_BYTES) return { error: 'Arquivo muito grande. Limite de 4 MB.' }
  const legenda = (formData.get('legenda') as string | null)?.trim() || undefined

  const admin = createAdminClient()
  const { data: conv } = await admin
    .from('conversations')
    .select('id, wa_number')
    .eq('id', conversationId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!conv?.wa_number) return { error: 'Acesso negado.' }

  const bytes = await file.arrayBuffer()

  const upload = await uploadMidiaWhatsApp(bytes, file.type)
  if (!upload.ok) return { error: upload.erro }

  const envio = await enviarMidiaWhatsApp(conv.wa_number, upload.mediaId, tipo, legenda)

  // Nossa própria cópia (bucket privado) — mesmo padrão do avatar/timbrados: guarda
  // só o PATH, nunca uma URL pública (a página resolve com signed URL sob demanda).
  const extensao = file.type.split('/')[1]?.split(';')[0] ?? 'bin'
  const path = `${empresaId}/${conversationId}/${crypto.randomUUID()}.${extensao}`
  const { error: uploadStorageErro } = await admin.storage.from('whatsapp-media').upload(path, bytes, {
    contentType: file.type,
  })

  // Se só o upload ao bucket falhar (Meta e DB ok), media_url fica null mas
  // media_mime continua setado — MidiaMensagem já trata esse caso exibindo
  // "Mídia indisponível" (não é um balão em branco).
  const { error: msgErr } = await admin.from('messages').insert({
    conversation_id: conversationId,
    direction: 'out',
    author_type: 'humano',
    texto: legenda ?? null,
    media_url: uploadStorageErro ? null : path,
    media_mime: file.type,
    delivery_status: envio.ok ? 'sent' : 'failed',
    wa_message_id: envio.ok ? envio.messageId : null,
    payload: envio.ok ? null : { erro: envio.erro },
  })
  if (msgErr) return { error: `Arquivo enviado, mas falhou ao registrar a mensagem: ${msgErr.message}` }
  if (!envio.ok) return { error: envio.erro }

  // Paridade com o texto normal (proxy pro app-sdr): assumir a conversa manualmente
  // também muda o status pra 'humano' e cala o bot.
  await admin.from('conversations').update({ status: 'humano', ia_ativa: false }).eq('id', conversationId)
  await marcarMensagensRespondidas(admin, conversationId)

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
 * Envia uma resposta pelo WhatsApp numa conversa existente — direto pela Cloud
 * API da Meta (mesmo padrão de `iniciarConversa`), sem depender do app-sdr.
 */
export async function responderConversa(
  id: string,
  texto: string,
): Promise<{ error?: string; foraDaJanela24h?: boolean }> {
  const { empresaId } = await authEmpresa()
  const msg = texto?.trim()
  if (!msg) return { error: 'Digite uma mensagem.' }

  const admin = createAdminClient()
  const { data: conv } = await admin
    .from('conversations')
    .select('id, wa_number')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!conv?.wa_number) return { error: 'Acesso negado.' }

  const envio = await enviarMensagemWhatsApp(conv.wa_number, msg)

  const { error: msgErr } = await admin.from('messages').insert({
    conversation_id: id,
    direction: 'out',
    author_type: 'humano',
    texto: msg,
    delivery_status: envio.ok ? 'sent' : 'failed',
    wa_message_id: envio.ok ? envio.messageId : null,
    payload: envio.ok ? null : { erro: envio.erro },
  })
  if (msgErr) return { error: `Mensagem enviada, mas falhou ao registrar no histórico: ${msgErr.message}` }
  if (!envio.ok) return { error: envio.erro, foraDaJanela24h: envio.foraDaJanela24h }

  await admin.from('conversations').update({ status: 'humano', ia_ativa: false }).eq('id', id)
  await marcarMensagensRespondidas(admin, id)

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

const JANELA_ATENDIMENTO_MS = 24 * 60 * 60 * 1000

/**
 * Normaliza um número de WhatsApp BR pro formato canônico usado em
 * `conversations.wa_number`: DDD + 9º dígito + 8 dígitos (11 dígitos), sem
 * DDI 55. Aceita entrada com ou sem DDI, com ou sem o 9º dígito — sem isso,
 * o mesmo contato digitado em formatos diferentes (ex.: com/sem DDI, número
 * antigo sem o 9) gerava/achava conversas DIFERENTES pro mesmo número real
 * (bug real: 6 conversas presas sem o 9, 1 duplicata de conversa em prod,
 * 2026-07-21). Nunca REMOVE um 9 real do usuário — só insere quando falta.
 */
function normalizarNumeroWhatsApp(numeroDigitado: string): string {
  let d = numeroDigitado?.replace(/\D/g, '') ?? ''
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length === 10) d = `${d.slice(0, 2)}9${d.slice(2)}`
  return d
}

/**
 * Verifica, só de leitura, se o número já tem conversa com mensagem recebida
 * há menos de 24h — usado por "Nova conversa" pra já avisar antes de tentar
 * texto livre (que a Meta vai rejeitar) quando o contato nunca falou ou
 * esfriou. Sem conversa/sem `last_inbound_at`/erro de query = `false`
 * (conservador: melhor oferecer o template à toa do que tentar texto livre
 * fadado a falhar). O envio real continua sendo a fonte da verdade — isso é
 * só uma dica de UX, não substitui o retorno `foraDaJanela24h` da Meta.
 */
export async function verificarJanela24hWhatsApp(numero: string): Promise<{ dentroDaJanela: boolean }> {
  const { empresaId } = await authEmpresa()
  const num = normalizarNumeroWhatsApp(numero)
  if (!num || num.length < 10) return { dentroDaJanela: false }

  const admin = createAdminClient()
  const { data: conv, error } = await admin
    .from('conversations')
    .select('last_inbound_at')
    .eq('empresa_id', empresaId)
    .eq('wa_number', num)
    .maybeSingle()
  if (error || !conv?.last_inbound_at) return { dentroDaJanela: false }

  const decorrido = Date.now() - new Date(conv.last_inbound_at).getTime()
  return { dentroDaJanela: decorrido < JANELA_ATENDIMENTO_MS }
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

  // order + limit(1) em vez de .maybeSingle() puro: se por algum motivo
  // excepcional existir mais de uma conversa pro mesmo número (resíduo de bug
  // antigo de normalização), reusa sempre a MAIS ANTIGA em vez de lançar erro
  // de "mais de uma linha" ou criar mais uma duplicata.
  const { data: existentes } = await admin
    .from('conversations')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('wa_number', num)
    .order('created_at', { ascending: true })
    .limit(1)

  let convId = existentes?.[0]?.id
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
  const num = normalizarNumeroWhatsApp(numero)
  if (num.length !== 11) return { error: 'Número inválido (use DDD + número).' }
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
    await marcarMensagensRespondidas(admin, convId)
  }

  revalidatePath('/atendimento')
  return { id: convId }
}

/**
 * Templates aprovados na Meta pra este WhatsApp Business Account — cacheado
 * por 5min (mesmo padrão do Google Calendar em dashboard/page.tsx) pra não
 * bater na Graph API toda vez que alguém abrir o diálogo de reabrir conversa.
 * Nunca lança: se a consulta falhar, devolve lista vazia (a UI mostra que
 * nenhum template foi encontrado em vez de quebrar a tela).
 */
const listarTemplatesCache = unstable_cache(
  () => listarTemplatesWhatsApp(),
  ['whatsapp-templates'],
  { revalidate: 300 },
)

export async function listarTemplatesWhatsAppAtivos(): Promise<WhatsAppTemplateInfo[]> {
  await authEmpresa()
  const res = await listarTemplatesCache().catch(() => null)
  return res?.ok ? res.templates : []
}

/**
 * Valores sugeridos pra prefill das duas primeiras variáveis de um template
 * (convenção observada nos templates atuais: {{1}}=nome do cliente,
 * {{2}}=quem está atendendo) — a tela de conferência sempre deixa a pessoa
 * editar antes de enviar, isso é só ponto de partida.
 */
export async function sugerirValoresTemplate(
  clienteId?: string,
): Promise<{ nomeCliente: string; nomeAtendente: string }> {
  const { empresaId, userId } = await authEmpresa()
  const admin = createAdminClient()

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

  return { nomeCliente, nomeAtendente }
}

/**
 * Reabre contato fora da janela de 24h enviando um template aprovado pela
 * Meta em vez de texto livre — a Graph API rejeita texto livre nesse caso
 * (ver iniciarConversa/foraDaJanela24h). Cria/reusa a conversa igual
 * iniciarConversa (criarOuReusarConversa) e grava a mensagem enviada — o
 * texto do corpo do template com `variaveis` já substituídas em {{1}}, {{2}}
 * etc. (não o que o usuário digitaria numa mensagem livre — aqui não há
 * campo de mensagem livre, é sempre o template escolhido).
 *
 * `templateName` vem do client (o que a pessoa escolheu no painel), mas
 * `language`/`bodyText` NUNCA vêm do client — são resolvidos aqui contra a
 * lista de templates aprovados cacheada (`listarTemplatesWhatsAppAtivos`).
 * Sem isso, um payload forjado poderia gravar em `messages.texto` um corpo
 * que não corresponde ao que a Meta realmente processa no envio, mentindo
 * no histórico da conversa.
 */
export async function reabrirConversaComTemplate(
  numero: string,
  clienteId: string | undefined,
  templateName: string,
  variaveis: string[],
): Promise<{ error?: string; id?: string }> {
  const { empresaId } = await authEmpresa()
  const num = normalizarNumeroWhatsApp(numero)
  if (num.length !== 11) return { error: 'Número inválido (use DDD + número).' }

  const templatesAprovados = await listarTemplatesWhatsAppAtivos()
  const template = templatesAprovados.find((t) => t.name === templateName)
  if (!template) return { error: 'Esse modelo de mensagem não está mais disponível. Escolha outro.' }

  const admin = createAdminClient()
  const conv = await criarOuReusarConversa(empresaId, admin, num, clienteId)
  if (conv.error || !conv.id) return { error: conv.error ?? 'Falha ao iniciar a conversa.' }
  const convId = conv.id

  const envio = await enviarTemplateWhatsApp(num, template.name, template.language, variaveis)

  const textoRenderizado = variaveis.reduce(
    (texto, valor, i) => texto.replaceAll(`{{${i + 1}}}`, valor.trim() || `{{${i + 1}}}`),
    template.bodyText,
  )

  const { error: msgErr } = await admin.from('messages').insert({
    conversation_id: convId,
    direction: 'out',
    author_type: 'humano',
    texto: textoRenderizado,
    delivery_status: envio.ok ? 'sent' : 'failed',
    wa_message_id: envio.ok ? envio.messageId : null,
    payload: envio.ok ? null : { erro: envio.erro },
  })
  if (msgErr) return { error: `Conversa criada, mas falhou ao registrar a mensagem: ${msgErr.message}`, id: convId }
  if (!envio.ok) return { error: envio.erro, id: convId }
  await marcarMensagensRespondidas(admin, convId)

  revalidatePath('/atendimento')
  return { id: convId }
}
