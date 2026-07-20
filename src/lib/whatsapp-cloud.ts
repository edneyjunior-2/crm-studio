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
 * Envia uma mensagem de texto livre para `numeroDigitos` (só dígitos, com ou
 * sem DDI). Nunca lança — sempre devolve um resultado tipado, mesmo em erro
 * de rede/timeout, pra quem chama poder mostrar isso ao usuário sem derrubar
 * a Server Action.
 */
export async function enviarMensagemWhatsApp(
  numeroDigitos: string,
  texto: string,
): Promise<EnvioWhatsAppResultado> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) {
    return { ok: false, erro: 'Integração com o WhatsApp não está configurada (variáveis de ambiente ausentes).' }
  }

  const to = paraE164BR(numeroDigitos)
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
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: texto },
      }),
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
