import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'

const ADMIN_EMAIL = 'edneyjuniords@gmail.com'

/**
 * Roda a análise da Claude (com screenshot, se houver) sobre um bug
 * reportado e notifica o admin por e-mail. Usado tanto no envio original
 * (src/app/api/bug-report/route.ts) quanto ao reanalisar um bug já existente
 * (src/app/api/admin/bugs/[id]/reanalyze/route.ts) — mesma lógica, uma fonte
 * só, pra não divergir entre os dois pontos de entrada.
 *
 * CHAME COM AWAIT: nunca dispare sem esperar (fire-and-forget) — em
 * serverless (Vercel), a função pode ser encerrada antes do fetch à
 * Anthropic/Resend terminar.
 */
export async function analyzeAndNotifyBug(params: {
  reportId: string
  numero: number
  descricao: string
  contexto: Record<string, unknown>
  screenshot_base64: string | null
  screenshotUrl: string | null
  userName: string | null
  userRole: string | null
}) {
  const admin = createAdminClient()
  const { reportId, numero, descricao, contexto, screenshot_base64, userName, userRole } = params
  const chamado = `#${String(numero).padStart(3, '0')}`

  const systemPrompt = `Você é o assistente de suporte do CRM Studio, um SaaS brasileiro para PMEs.
Sua tarefa: analisar bugs reportados por usuários e retornar um JSON estruturado.

Responda SOMENTE com JSON válido, sem markdown, sem texto extra.`

  const userText = `Bug reportado:
- Descrição: "${descricao}"
- Página: ${contexto.url}
- Usuário: ${userName ?? 'desconhecido'} (${userRole ?? '?'})
- Empresa: ${contexto.empresa_nome ?? 'desconhecida'}
- Viewport: ${contexto.viewport ?? '?'}
- User-agent: ${String(contexto.user_agent ?? '').slice(0, 120)}

Classifique e retorne JSON com este schema exato:
{
  "categoria": "interface" | "dados" | "autenticacao" | "performance" | "email" | "integracao" | "outro",
  "severidade": "critica" | "alta" | "media" | "baixa",
  "titulo_curto": "string de até 80 caracteres",
  "causa_provavel": "string",
  "sugestao_correcao": "string",
  "proximos_passos": ["array de strings com até 3 ações concretas"],
  "precisa_atencao_imediata": boolean,
  "prompt_correcao": "string — prompt completo e autocontido para o Claude Code corrigir o problema. Deve incluir: contexto do bug, arquivo(s) provável(is), o que mudar e como testar. Escreva em português, direto ao ponto, como se fosse uma instrução para um engenheiro."
}`

  const messageContent: Anthropic.MessageParam['content'] = []

  if (screenshot_base64) {
    const base64 = screenshot_base64.replace(/^data:image\/\w+;base64,/, '')
    messageContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: base64 },
    })
  }
  messageContent.push({ type: 'text', text: userText })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let analise: Record<string, unknown> | null = null
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      // 1024 cortava a resposta no meio do JSON (o schema pede causa_provavel +
      // sugestao_correcao + prompt_correcao, um prompt completo e autocontido) —
      // JSON.parse falhava com "Unterminated string" e a análise nunca salvava,
      // silenciosamente (bug real, visto em produção: bug #2f3344d1).
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = resp.content.find((b) => b.type === 'text')?.text ?? ''
    analise = JSON.parse(text)
    await admin.from('bug_reports').update({ analise_claude: analise }).eq('id', reportId)
  } catch (err) {
    // Relatório fica sem análise, mas o e-mail abaixo ainda dispara — logado
    // pra não ficar invisível de novo se algo quebrar (era silencioso antes).
    console.error('[bug-analysis] falha na análise Claude:', err)
  }

  const sevLabel = analise?.severidade === 'critica' ? '🔴 CRÍTICO'
    : analise?.severidade === 'alta' ? '🟠 Alta'
    : analise?.severidade === 'media' ? '🟡 Média'
    : '🟢 Baixa'

  // screenshotUrl agora é o PATH no bucket privado, não uma URL clicável (o
  // bucket bug-reports não é público — ver bug-report/route.ts). O link "Ver
  // no painel admin" abaixo já leva pro screenshot (renderizado lá via signed
  // URL), então não precisa de link direto aqui.
  const screenshotHtml = params.screenshotUrl
    ? '<p>📷 Screenshot anexado — veja no painel admin.</p>'
    : '<p><em>Sem screenshot.</em></p>'

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'nao-responda@crmstudio.com.br',
    to: ADMIN_EMAIL,
    subject: `[Chamado ${chamado}] ${analise?.titulo_curto ?? descricao.slice(0, 60)}`,
    html: `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#14233A">
  <div style="background:#14233A;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#ECEAE3;font-size:18px;font-weight:700">CRM Studio</span><span style="color:#E8915B">.</span>
    <span style="color:#ECEAE3;opacity:.6;font-size:12px;margin-left:12px">Relatório de Bug</span>
  </div>
  <div style="border:1px solid #e5e5e5;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <h2 style="margin:0 0 4px">Chamado ${chamado} — ${analise?.titulo_curto ?? 'Novo bug reportado'}</h2>
    <p style="margin:0;color:#666;font-size:13px">Severidade: <strong>${sevLabel}</strong></p>
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">

    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#999;letter-spacing:.05em">Descrição do usuário</h3>
    <p style="background:#f5f5f5;padding:12px 16px;border-radius:8px;margin:0 0 16px">${descricao}</p>

    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#999;letter-spacing:.05em">Contexto</h3>
    <table style="font-size:13px;border-collapse:collapse;width:100%">
      <tr><td style="padding:4px 0;color:#666;width:120px">Página</td><td><code style="font-size:12px">${contexto.url}</code></td></tr>
      <tr><td style="padding:4px 0;color:#666">Usuário</td><td>${userName ?? '—'} (${userRole ?? '?'})</td></tr>
      <tr><td style="padding:4px 0;color:#666">Empresa</td><td>${contexto.empresa_nome ?? '—'}</td></tr>
      <tr><td style="padding:4px 0;color:#666">Viewport</td><td>${contexto.viewport ?? '—'}</td></tr>
    </table>

    ${analise ? `
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#999;letter-spacing:.05em">Análise do Claude</h3>
    <p><strong>Categoria:</strong> ${analise.categoria} &nbsp;|&nbsp; <strong>Severidade:</strong> ${sevLabel}</p>
    <p><strong>Causa provável:</strong> ${analise.causa_provavel}</p>
    <p><strong>Sugestão:</strong> ${analise.sugestao_correcao}</p>
    <ul>${(analise.proximos_passos as string[] ?? []).map((s) => `<li>${s}</li>`).join('')}</ul>
    ` : '<p><em>Análise Claude indisponível.</em></p>'}

    ${screenshotHtml}

    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
    <p style="font-size:12px;color:#aaa">
      <a href="https://app.crmstudio.com.br/admin/bugs/${reportId}">Ver no painel admin</a>
    </p>
  </div>
</div>`.trim(),
  }).catch((err: unknown) => {
    console.error('[bug-analysis] falha ao enviar e-mail de notificação:', err)
  })
}

/**
 * Avisa quem reportou o bug que ele foi resolvido. Não abre nenhum canal de
 * chamados novo — só aponta de volta pro botão "Teve um problema?" (já
 * existente em toda tela) caso a pessoa ainda veja algo estranho.
 *
 * CHAME COM AWAIT (mesmo motivo de analyzeAndNotifyBug acima).
 */
export async function notificarReporteResolvido(params: {
  reportId: string
  descricao: string
  userId: string
  userName: string | null
  notasResolucao?: string | null
}) {
  const { reportId, descricao, userId, userName, notasResolucao } = params
  const admin = createAdminClient()

  // E-mail vem da view profiles_auth (service-role) — NÃO admin.auth.admin.listUsers(),
  // que voltava vazio em prod neste projeto.
  const { data: pessoa } = await admin
    .from('profiles_auth')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (!pessoa?.email) {
    console.error('[bug-analysis] sem e-mail pra notificar resolução do bug', reportId)
    return
  }

  const primeiroNome = (userName ?? '').trim().split(' ')[0] || null

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'nao-responda@crmstudio.com.br',
    to: pessoa.email,
    subject: 'Resolvemos o problema que você reportou',
    html: `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#14233A">
  <div style="background:#14233A;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#ECEAE3;font-size:18px;font-weight:700">CRM Studio</span><span style="color:#E8915B">.</span>
  </div>
  <div style="border:1px solid #e5e5e5;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <h2 style="margin:0 0 12px">Tudo certo${primeiroNome ? `, ${primeiroNome}` : ''}! ✅</h2>
    <p style="margin:0 0 16px;line-height:1.5">
      O problema que você reportou foi resolvido:
    </p>
    <p style="background:#f5f5f5;padding:12px 16px;border-radius:8px;margin:0 0 16px;font-style:italic">
      "${descricao}"
    </p>
    ${notasResolucao?.trim() ? `
    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#999;letter-spacing:.05em">O que foi feito</h3>
    <p style="margin:0 0 16px;line-height:1.5">${notasResolucao.trim()}</p>
    ` : ''}
    <p style="margin:0 0 16px;line-height:1.5">
      Se ainda notar algo estranho ou encontrar outro problema, é só reportar de novo pelo botão
      <strong>"Teve um problema?"</strong> no menu lateral do sistema — a gente recebe direto.
    </p>
    <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
    <p style="font-size:12px;color:#aaa;margin:0">Obrigado por ajudar a melhorar o CRM Studio.</p>
  </div>
</div>`.trim(),
  }).catch((err: unknown) => {
    console.error('[bug-analysis] falha ao enviar e-mail de resolução:', err)
  })
}
