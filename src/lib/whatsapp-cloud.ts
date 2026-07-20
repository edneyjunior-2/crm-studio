import 'server-only'

/**
 * Envio de mensagens de texto via WhatsApp Cloud API (Meta Graph API).
 *
 * Usado pelo nº2 do WhatsApp (chat humano, módulo Atendimento) — separado do
 * nº1 (robô Leila/SDR, que roda no app-sdr e é acionado via `responderConversa`
 * em atendimento-actions.ts). Hoje há só UM conjunto de credenciais (fase
 * pré-receita, 1 tenant real): `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`.
 * Não existe (ainda) uma tabela de credenciais por empresa — se isso mudar,
 * troque `getConfig()` para ler por `empresaId` em vez do `.env`.
 */

const GRAPH_API_VERSION = 'v20.0'

/** code da Graph API quando a mensagem é business-initiated fora da janela de
 * atendimento de 24h (a Meta exige template aprovado nesse caso). */
const CODIGO_FORA_DA_JANELA_24H = 131047

export type EnvioWhatsAppResultado =
  | { ok: true; messageId: string }
  | { ok: false; erro: string; foraDaJanela24h?: boolean }

interface GraphApiErroResposta {
  error?: { message?: string; code?: number; error_data?: { details?: string } }
}

interface GraphApiSucessoResposta {
  messages?: { id: string }[]
}

/** Garante DDI 55 (Brasil) — a Graph API exige o número completo (DDI+DDD+linha). */
function paraE164BR(numeroDigitos: string): string {
  if (numeroDigitos.startsWith('55') && numeroDigitos.length >= 12) return numeroDigitos
  return `55${numeroDigitos}`
}

/**
 * POST genérico em `/{phone_number_id}/messages` — usado tanto pra texto livre
 * quanto pra template (a única diferença entre `enviarMensagemWhatsApp` e
 * `enviarTemplateWhatsApp` é o corpo da requisição). Nunca lança — sempre
 * devolve um resultado tipado, mesmo em erro de rede/timeout/parsing, pra quem
 * chama poder mostrar isso ao usuário sem derrubar a Server Action.
 */
async function enviarParaGraphApi(body: Record<string, unknown>): Promise<EnvioWhatsAppResultado> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) {
    return { ok: false, erro: 'Integração com o WhatsApp não está configurada (variáveis de ambiente ausentes).' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)

  let res: Response
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e) {
    const motivo = e instanceof Error && e.name === 'AbortError'
      ? 'demorou demais para responder (timeout)'
      : e instanceof Error ? e.message : 'erro desconhecido'
    return { ok: false, erro: `Não foi possível conectar ao WhatsApp agora (${motivo}). Tente novamente.` }
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as GraphApiErroResposta | null
    const codigo = corpo?.error?.code
    if (codigo === CODIGO_FORA_DA_JANELA_24H) {
      return {
        ok: false,
        foraDaJanela24h: true,
        erro:
          'Esse cliente não conversou nas últimas 24h — a Meta exige um modelo de mensagem (template) aprovado para iniciar contato fora dessa janela.',
      }
    }
    const detalhe = corpo?.error?.message ?? `HTTP ${res.status}`
    return { ok: false, erro: `Falha ao enviar pelo WhatsApp: ${detalhe}` }
  }

  const corpo = (await res.json().catch(() => null)) as GraphApiSucessoResposta | null
  const messageId = corpo?.messages?.[0]?.id
  if (!messageId) {
    return { ok: false, erro: 'A Meta aceitou o envio, mas não retornou o ID da mensagem.' }
  }
  return { ok: true, messageId }
}

/**
 * Envia uma mensagem de texto livre para `numeroDigitos` (só dígitos, com ou
 * sem DDI). Nunca lança — sempre devolve um resultado tipado, mesmo em erro
 * de rede/timeout, pra quem chama poder mostrar isso ao usuário sem derrubar
 * a Server Action.
 */
export async function enviarMensagemWhatsApp(
  numeroDigitos: string,
  texto: string,
): Promise<EnvioWhatsAppResultado> {
  return enviarParaGraphApi({
    messaging_product: 'whatsapp',
    to: paraE164BR(numeroDigitos),
    type: 'text',
    text: { body: texto },
  })
}

/**
 * Envia o template `retomar_atendimento` (pt_BR; consta como MARKETING na
 * Meta, em análise em 2026-07-20) —
 * único jeito de reabrir contato fora da janela de 24h (a Meta rejeita texto
 * livre nesse caso, ver `CODIGO_FORA_DA_JANELA_24H`). Corpo do template: "Olá
 * {{1}}, aqui é {{2}}. Estamos entrando em contato para dar continuidade ao
 * seu atendimento. Pode responder esta mensagem quando for possível."
 *
 * `nomeCliente` vai em {{1}} (nome do cliente, ou um fallback genérico tipo
 * "Cliente" quando não há cadastro vinculado) e `nomeAtendente` vai em {{2}}
 * (nome de quem está atendendo + empresa, ex.: "Fulano, da Empresa X").
 */
export async function enviarTemplateWhatsApp(
  numeroDigitos: string,
  nomeCliente: string,
  nomeAtendente: string,
): Promise<EnvioWhatsAppResultado> {
  return enviarParaGraphApi({
    messaging_product: 'whatsapp',
    to: paraE164BR(numeroDigitos),
    type: 'template',
    template: {
      name: 'retomar_atendimento',
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: nomeCliente },
            { type: 'text', text: nomeAtendente },
          ],
        },
      ],
    },
  })
}

// ---------------------------------------------------------------------------
// Foto do perfil comercial — a foto que o CLIENTE vê no WhatsApp dele
// ---------------------------------------------------------------------------

export type FotoWhatsAppUrlResultado = { ok: true; url: string | null } | { ok: false; erro: string }
export type FotoWhatsAppUploadResultado = { ok: true } | { ok: false; erro: string }

/**
 * true quando TODAS as credenciais necessárias pra TROCAR a foto existem —
 * incluindo `WHATSAPP_APP_ID`, que a leitura da foto não usa. A UI usa isso
 * pra desabilitar o upload com aviso claro em vez de deixar o usuário
 * escolher um arquivo e só então tomar o erro.
 */
export function uploadFotoWhatsAppConfigurado(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_APP_ID,
  )
}

/** fetch com timeout de 15s que nunca lança — erro de rede vira `null`. */
async function fetchGraphApi(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * URL da foto atual do perfil comercial do WhatsApp. `url: null` quando o
 * número ainda não tem foto. Nunca lança — erro vira resultado tipado.
 */
export async function obterFotoPerfilWhatsApp(): Promise<FotoWhatsAppUrlResultado> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) {
    return { ok: false, erro: 'Integração com o WhatsApp não está configurada.' }
  }

  const res = await fetchGraphApi(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res || !res.ok) {
    return { ok: false, erro: 'Não foi possível consultar o perfil do WhatsApp agora.' }
  }

  const corpo = (await res.json().catch(() => null)) as
    | { data?: { profile_picture_url?: string }[] }
    | null
  return { ok: true, url: corpo?.data?.[0]?.profile_picture_url ?? null }
}

/**
 * Troca a foto do perfil comercial do WhatsApp. Fluxo em 3 passos da Meta:
 * (1) abre uma sessão na Resumable Upload API (exige o APP ID do app Meta —
 * env `WHATSAPP_APP_ID`), (2) sobe o binário e recebe um handle `h`,
 * (3) aplica o handle em `whatsapp_business_profile`. A foto aparece para o
 * cliente no WhatsApp dele (pode levar alguns minutos para propagar).
 *
 * Nunca lança — sempre devolve resultado tipado, mesmo em erro de rede.
 */
export async function atualizarFotoPerfilWhatsApp(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<FotoWhatsAppUploadResultado> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const appId = process.env.WHATSAPP_APP_ID
  if (!phoneNumberId || !accessToken || !appId) {
    return { ok: false, erro: 'Integração com o WhatsApp não está configurada (variáveis de ambiente ausentes).' }
  }

  // 1) Sessão de upload
  const sessaoRes = await fetchGraphApi(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${appId}/uploads?file_length=${bytes.byteLength}&file_type=${encodeURIComponent(mimeType)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const sessao = sessaoRes ? ((await sessaoRes.json().catch(() => null)) as { id?: string } | null) : null
  if (!sessaoRes?.ok || !sessao?.id) {
    return { ok: false, erro: 'A Meta não aceitou o início do envio da foto. Tente novamente.' }
  }

  // 2) Binário → handle (a Resumable Upload API exige "OAuth" no header, não "Bearer")
  const uploadRes = await fetchGraphApi(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${sessao.id}`,
    {
      method: 'POST',
      headers: { Authorization: `OAuth ${accessToken}`, file_offset: '0' },
      body: bytes,
    },
  )
  const upload = uploadRes ? ((await uploadRes.json().catch(() => null)) as { h?: string } | null) : null
  if (!uploadRes?.ok || !upload?.h) {
    return { ok: false, erro: 'Falha ao enviar a foto para a Meta. Tente novamente.' }
  }

  // 3) Aplica no perfil comercial
  const perfilRes = await fetchGraphApi(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/whatsapp_business_profile`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: upload.h }),
    },
  )
  if (!perfilRes?.ok) {
    const corpo = perfilRes ? ((await perfilRes.json().catch(() => null)) as GraphApiErroResposta | null) : null
    const detalhe = corpo?.error?.message
    return { ok: false, erro: detalhe ? `A Meta recusou a foto: ${detalhe}` : 'A Meta recusou a foto. Tente novamente.' }
  }
  return { ok: true }
}
