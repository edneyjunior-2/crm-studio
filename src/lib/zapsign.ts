/**
 * zapsign.ts — Cliente da API ZapSign (assinatura eletrônica de contratos)
 *
 * Cria um documento para assinatura a partir de um PDF em base64 e devolve o
 * link de assinatura do signatário. `fetch` nativo, sem SDK — sem dependência
 * nova no projeto.
 *
 * Credencial: `ZAPSIGN_API_KEY`, global da plataforma (mesmo padrão de
 * Asaas/Resend/DataJud — nunca por tenant). Diferente do `email.ts` (que faz
 * `console.warn` + retorno mudo quando falta a chave do Resend), aqui a
 * ausência da chave LANÇA erro — esta função é chamada por uma ação explícita
 * do usuário ("Enviar para assinatura"), não um envio em background, e a
 * falta de configuração precisa virar toast de erro visível.
 *
 * ---------------------------------------------------------------------------
 * Fontes consultadas em 2026-07-13 (WebFetch/WebSearch — doc pública do
 * ZapSign não tem endpoint de busca textual, então cada URL abaixo foi lida
 * individualmente):
 *
 * - https://docs.zapsign.com.br/documentos/criar-documento
 *   (e a versão em inglês, https://docs.zapsign.com.br/english/documentos/criar-documento)
 *   → confirma: `POST https://api.zapsign.com.br/api/v1/docs/`, corpo com
 *   `name` (título, até 255 chars), `base64_pdf` (sem o prefixo
 *   `data:application/pdf;base64,`), `lang` (default `"pt-br"`) e `signers`
 *   (array). Resposta: `token` (id do documento), `status`, `signed_file`
 *   (null até assinar), e `signers[]` com `token`, `sign_url` (formato
 *   `https://app.zapsign.co/verificar/{signer_token}`), `status`, `signed_at`.
 *
 * - https://docs.zapsign.com.br/signatarios/adicionar-signatario
 *   → confirma os campos de signatário: `name`, `email`, `phone_country`
 *   (ex.: `"55"`), `phone_number`, `auth_mode`, `qualification` (só rótulo
 *   pro relatório, não afeta o nível de assinatura). Valores documentados de
 *   `auth_mode`: `"assinaturaTela"` (default), `"tokenEmail"`,
 *   `"assinaturaTela-tokenEmail"`, `"tokenSms"`, `"assinaturaTela-tokenSms"`,
 *   `"tokenWhatsApp"`, `"assinaturaTela-tokenWhatsApp"` e
 *   `"certificadoDigital"`.
 *
 * - Autenticação da API: header `Authorization: Bearer <ZAPSIGN_API_KEY>`
 *   (confirmado no exemplo da doc de criar-documento).
 *
 * MODALIDADE DE ASSINATURA: a API do ZapSign NÃO tem um campo dedicado tipo
 * "nível" ou "força" — é controlado indiretamente pelo `auth_mode` de cada
 * signatário. O admin escolhe a modalidade por empresa (ver
 * `modelo-contrato-section.tsx`), entre 4 opções — decisão do dono em
 * 2026-07-14: só expor modalidades SEM custo extra (simples/email/sms) mais a
 * qualificada (paga, mantida de propósito pra advocacia — ônus da prova).
 * Nunca expor tokenWhatsApp nem `selfie_validation_type` (biometria) como
 * opção — ambos consomem crédito ZapSign e não fazem parte do escopo atual:
 *
 *   - 'simples'    → auth_mode "assinaturaTela" (só o nome na tela, sem 2º fator)
 *   - 'email'      → auth_mode "assinaturaTela-tokenEmail" (exige e-mail do signatário)
 *   - 'sms'        → auth_mode "assinaturaTela-tokenSms" (exige telefone do signatário)
 *   - 'qualificada'→ auth_mode "certificadoDigital" (ICP-Brasil, paga)
 *
 * 'email'/'sms' exigem o dado de contato correspondente no signatário —
 * `resolverAuthMode` lança erro claro se faltar, em vez de silenciosamente
 * cair pra outra modalidade (o admin escolheu essa modalidade de propósito).
 *
 * WEBHOOK (para o agente que vai construir `src/app/api/webhooks/zapsign/route.ts`):
 * - https://docs.zapsign.com.br/webhooks/criar-webhook (e a versão em inglês)
 *   → cadastro via `POST https://api.zapsign.com.br/api/v1/user/company/webhook/`
 *   com `url`, `type` (evento) e, opcionalmente, `headers` (array de headers
 *   customizados enviados pelo ZapSign na chamada). A doc NÃO documenta HMAC
 *   nem assinatura de payload nativa — o único mecanismo de segurança citado
 *   é configurar headers customizados na hora de cadastrar o webhook (ex.:
 *   um `Authorization: Bearer <token nosso>` que o próprio ZapSign vai
 *   ecoar em toda chamada). Ou seja: NÃO existe verificação nativa — a spec
 *   já previa isso e a decisão (token próprio na query string da URL do
 *   webhook, validado com `crypto.timingSafeEqual`, mesmo padrão do Asaas) é
 *   a rota certa. Cadastrar a URL do webhook no painel ZapSign como algo do
 *   tipo `https://app.crmstudio.com.br/api/webhooks/zapsign?token=...`.
 * - Eventos confirmados: `doc_created`, `doc_signed`, `doc_refused`,
 *   `doc_deleted`, `email_bounce` (não incluído no filtro "todos").
 * - IMPORTANTE — `doc_signed` dispara a CADA assinatura individual (um
 *   signatário assinando entre vários já dispara o evento), NÃO só quando
 *   todos terminam. Para saber se o documento está COMPLETO, checar o campo
 *   `status` do payload no nível do documento: `"signed"` = todos assinaram;
 *   `"pending"` = ainda falta alguém. `doc_refused` é o evento de recusa.
 *   O token do documento vem no campo `token` do payload (mesmo nome da
 *   resposta de criação). O PDF assinado final vem em `signed_file` (URL
 *   temporária, expira em ~60 min — baixar e subir pro Storage na hora).
 * ---------------------------------------------------------------------------
 */

const ZAPSIGN_BASE = 'https://api.zapsign.com.br/api/v1'

// 30s: upload de PDF + processamento no ZapSign é mais pesado que uma consulta
// simples (comparar com os 15s do datajud.ts, que é só leitura).
const ZAPSIGN_TIMEOUT_MS = 30_000

export interface ZapSignSignatario {
  nome: string
  email?: string
  telefone?: string
}

export type ModalidadeAssinatura = 'simples' | 'email' | 'sms' | 'qualificada'

export async function criarDocumentoAssinatura(params: {
  pdfBase64: string
  nomeArquivo: string
  signatarios: Array<{ nome: string; email?: string; telefone?: string }>
  modalidade: ModalidadeAssinatura
}): Promise<{ token: string; linkAssinatura: string }> {
  const apiKey = process.env.ZAPSIGN_API_KEY
  if (!apiKey) {
    throw new Error('ZAPSIGN_API_KEY não configurada')
  }

  if (params.signatarios.length === 0) {
    throw new Error('É necessário informar ao menos um signatário para enviar o documento à assinatura.')
  }

  const body = JSON.stringify({
    name: params.nomeArquivo,
    base64_pdf: params.pdfBase64,
    lang: 'pt-br',
    signers: params.signatarios.map((s) => mapearSignatario(s, params.modalidade)),
  })

  // NOTA: assinatura em PARALELO (todos recebem o link de uma vez, assinam em
  // qualquer ordem) — é o default do ZapSign. Para exigir ordem (ex.: cliente
  // primeiro, empresa depois) seria preciso `signature_order_active: true` no
  // documento + `order_group` em cada signatário. Decisão do dono (2026-07-14):
  // paralelo.

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ZAPSIGN_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${ZAPSIGN_BASE}/docs/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body,
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[zapsign] timeout ao criar documento "${params.nomeArquivo}"`)
      throw new Error('Tempo limite excedido ao comunicar com o ZapSign. Tente novamente.')
    }
    console.error('[zapsign] erro de rede ao criar documento:', err)
    throw new Error('Não foi possível conectar ao ZapSign. Verifique a conexão e tente novamente.')
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    // Loga o corpo cru só no servidor (debug) — nunca repassa pro chamador.
    const corpo = await res.json().catch(() => undefined)
    console.error(`[zapsign] HTTP ${res.status} ao criar documento "${params.nomeArquivo}":`, corpo)
    throw new Error(mensagemErroHttp(res.status))
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    console.error('[zapsign] resposta inválida (não-JSON) do ZapSign:', err)
    throw new Error('Resposta inesperada do ZapSign. Tente novamente mais tarde.')
  }

  const doc = json as { token?: string; signers?: Array<{ sign_url?: string }> }
  // Cada signatário tem seu PRÓPRIO sign_url e já recebeu por e-mail
  // (send_automatic_email). Guardamos o link do 1º (a contraparte) só como
  // recurso de reenvio manual — ex.: o cliente diz que não recebeu o e-mail e
  // o usuário reencaminha o link por WhatsApp. NÃO abrir esse link
  // automaticamente no navegador de quem enviou: é o link pessoal de
  // assinatura da contraparte.
  const linkAssinatura = doc.signers?.[0]?.sign_url

  if (!doc.token || !linkAssinatura) {
    console.error('[zapsign] resposta sem token ou sign_url:', json)
    throw new Error('O ZapSign não retornou o link de assinatura esperado.')
  }

  return { token: doc.token, linkAssinatura }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapearSignatario(signatario: ZapSignSignatario, modalidade: ModalidadeAssinatura) {
  const { phone_country, phone_number } = separarTelefone(signatario.telefone)
  if (!signatario.email) {
    throw new Error(`Informe o e-mail de "${signatario.nome}" — cada signatário recebe o link de assinatura no próprio e-mail.`)
  }
  return {
    name:          signatario.nome,
    email:         signatario.email,
    phone_country,
    phone_number,
    auth_mode:     resolverAuthMode(modalidade, signatario),
    // CRÍTICO: o default do ZapSign é `false` — sem isso, o documento é criado
    // e NINGUÉM é avisado (o link teria que ser entregue por fora, na mão).
    // Com `true`, cada signatário recebe no PRÓPRIO e-mail o SEU link
    // individual de assinatura. Confirmado na doc oficial (docs.zapsign.com.br,
    // seção "Configurando signatários").
    send_automatic_email: true,
  }
}

// Mapeamento direto modalidade → auth_mode (ver nota no topo do arquivo).
// 'email'/'sms' exigem o dado de contato correspondente — o admin escolheu
// essa modalidade de propósito, então a ausência do dado vira erro claro em
// vez de silenciosamente cair pra outra modalidade.
function resolverAuthMode(modalidade: ModalidadeAssinatura, signatario: ZapSignSignatario): string {
  if (modalidade === 'qualificada') return 'certificadoDigital'
  if (modalidade === 'email') {
    if (!signatario.email) throw new Error(`Informe o e-mail do signatário "${signatario.nome}" — a empresa exige confirmação por e-mail.`)
    return 'assinaturaTela-tokenEmail'
  }
  if (modalidade === 'sms') {
    if (!signatario.telefone) throw new Error(`Informe o telefone do signatário "${signatario.nome}" — a empresa exige confirmação por SMS.`)
    return 'assinaturaTela-tokenSms'
  }
  return 'assinaturaTela'
}

// ZapSign espera `phone_country` (código do país, ex.: "55") e `phone_number`
// (DDD + número, sem o código do país) como campos separados. Aceita telefone
// vindo com ou sem "+55"/"55" na frente; assume Brasil (único mercado do
// produto hoje) quando não dá pra distinguir com segurança.
function separarTelefone(telefone?: string): { phone_country?: string; phone_number?: string } {
  if (!telefone) return {}
  const digitos = telefone.replace(/\D/g, '')
  if (!digitos) return {}
  if (digitos.startsWith('55') && digitos.length > 11) {
    return { phone_country: '55', phone_number: digitos.slice(2) }
  }
  return { phone_country: '55', phone_number: digitos }
}

function mensagemErroHttp(status: number): string {
  if (status === 401 || status === 403) {
    return 'Falha de autenticação com o ZapSign. Verifique a configuração (ZAPSIGN_API_KEY).'
  }
  if (status === 429) {
    return 'Limite de requisições do ZapSign atingido. Aguarde alguns instantes e tente novamente.'
  }
  if (status >= 500) {
    return 'O ZapSign está temporariamente indisponível. Tente novamente mais tarde.'
  }
  return 'Não foi possível enviar o documento para o ZapSign. Verifique os dados do contrato e do signatário.'
}
