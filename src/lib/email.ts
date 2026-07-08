import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM ?? 'CRM Studio <nao-responda@crmstudio.com.br>'

// Paleta oficial da marca
const NAVY  = '#14233A'
const AMBER = '#E8915B'
const BONE  = '#ECEAE3'

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.crmstudio.com.br'
  return url.startsWith('https://') || url.startsWith('http://localhost')
    ? url
    : 'https://app.crmstudio.com.br'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripHeaders(s: string): string {
  return s.replace(/[\r\n]+/g, ' ')
}

function ctaButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td style="background:${AMBER};border-radius:8px;">
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
        ${label}
      </a>
    </td></tr>
  </table>`
}

function emailShell(title: string, body: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${BONE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BONE};padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <tr><td style="background:${NAVY};padding:28px 32px;text-align:center;">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">CRM Studio<span style="color:${AMBER};">.</span></span>
      </td></tr>
      <tr><td style="padding:36px 32px;">${body}</td></tr>
      <tr><td style="background:#f8f7f4;border-top:1px solid #e5e2da;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">${footer}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export async function sendWelcomeEmail({
  to,
  nome,
  empresaNome,
}: {
  to: string
  nome: string
  empresaNome: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const safeNome = stripHeaders(nome)
  const safeEmpresa = stripHeaders(empresaNome)
  const safeTo = stripHeaders(to)

  try {
    await resend.emails.send({
      from: FROM,
      to: safeTo,
      subject: `Bem-vindo ao CRM Studio, ${safeNome}!`,
      html: buildWelcomeHtml({ nome: safeNome, empresaNome: safeEmpresa }),
    })
  } catch (err) {
    console.error('[email] Falha ao enviar e-mail de boas-vindas:', err)
  }
}

export async function sendInviteEmail({
  to,
  nome,
  empresaNome,
  linkAcesso,
}: {
  to: string
  nome: string
  empresaNome: string
  linkAcesso: string
}): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — convite não enviado')
    return { sent: false, reason: 'sem_api_key' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const safeNome = stripHeaders(nome)
  const safeEmpresa = stripHeaders(empresaNome)
  const safeTo = stripHeaders(to)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: safeTo,
      subject: `Seu acesso ao CRM Studio — ${safeEmpresa}`,
      html: buildInviteHtml({ nome: safeNome, empresaNome: safeEmpresa, linkAcesso }),
    })
    if (error) {
      console.error('[email] Resend recusou o convite:', error)
      return { sent: false, reason: error.message }
    }
    return { sent: true }
  } catch (err) {
    console.error('[email] Falha ao enviar convite de primeiro acesso:', err)
    return { sent: false, reason: err instanceof Error ? err.message : 'erro' }
  }
}

/**
 * Alerta operacional INTERNO (para o dono da plataforma, não para o cliente).
 * Usado p/ avisar sobre contas perto da purga e confirmar purgas concluídas.
 */
export async function sendAlertaInterno({
  to,
  assunto,
  titulo,
  descricao,
  linhas,
  destaque = 'aviso',
}: {
  to: string
  assunto: string
  titulo: string
  descricao: string
  linhas: string[]
  destaque?: 'aviso' | 'perigo'
}): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — alerta interno não enviado')
    return { sent: false, reason: 'sem_api_key' }
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: stripHeaders(to),
      subject: stripHeaders(assunto),
      html: buildAlertaHtml({ titulo, descricao, linhas, destaque }),
    })
    if (error) {
      console.error('[email] Resend recusou o alerta interno:', error)
      return { sent: false, reason: error.message }
    }
    return { sent: true }
  } catch (err) {
    console.error('[email] Falha ao enviar alerta interno:', err)
    return { sent: false, reason: err instanceof Error ? err.message : 'erro' }
  }
}

function buildAlertaHtml({
  titulo,
  descricao,
  linhas,
  destaque,
}: {
  titulo: string
  descricao: string
  linhas: string[]
  destaque: 'aviso' | 'perigo'
}): string {
  const corFaixa = destaque === 'perigo' ? '#dc2626' : AMBER
  const adminUrl = `${getAppUrl()}/admin/empresas`
  const itens = linhas
    .map((l) => `<li style="color:#374151;font-size:14px;line-height:1.9;">${escapeHtml(l)}</li>`)
    .join('')

  return emailShell(
    titulo,
    `<div style="background:${corFaixa};border-radius:8px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;">${escapeHtml(titulo)}</p>
    </div>
    <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 16px;">${escapeHtml(descricao)}</p>
    <ul style="padding-left:18px;margin:0 0 28px;">${itens}</ul>
    ${ctaButton(adminUrl, 'Abrir o Admin →')}`,
    'CRM Studio. · alerta automático da plataforma',
  )
}

function buildInviteHtml({
  nome,
  empresaNome,
  linkAcesso,
}: {
  nome: string
  empresaNome: string
  linkAcesso: string
}): string {
  const safeName = escapeHtml(nome)
  const safeEmpresa = escapeHtml(empresaNome)
  const href = encodeURI(linkAcesso)

  return emailShell(
    'Convite — CRM Studio.',
    `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${NAVY};">Olá, ${safeName}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Sua conta de acesso ao <strong style="color:${NAVY};">CRM Studio.</strong> para
      <strong style="color:${NAVY};">${safeEmpresa}</strong> foi criada.<br>
      Clique no botão abaixo para definir sua senha e começar a usar.
    </p>
    ${ctaButton(href, 'Definir minha senha →')}
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Se o botão não funcionar, copie e cole este link:</p>
    <p style="margin:4px 0 0;font-size:12px;color:${AMBER};word-break:break-all;">${href}</p>`,
    'Este link é pessoal e expira em 24 horas. Se você não esperava este e-mail, pode ignorá-lo com segurança.',
  )
}

function buildWelcomeHtml({
  nome,
  empresaNome,
}: {
  nome: string
  empresaNome: string
}): string {
  // Trial com cartão obrigatório (ver .claude/specs/trial-com-cartao.md): o
  // trial só COMEÇA quando o webhook do Asaas confirma o cartão em
  // /cadastro/pagamento — este e-mail dispara ANTES disso, então não pode
  // prometer "sem cartão" nem mandar direto pro /dashboard (o gate de acesso
  // devolveria a pessoa pra cá mesmo assim, mas o texto ficaria enganoso).
  const pagamentoUrl = `${getAppUrl()}/cadastro/pagamento`
  const safeName = escapeHtml(nome)
  const safeEmpresa = escapeHtml(empresaNome)

  return emailShell(
    'Bem-vindo ao CRM Studio.',
    `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${NAVY};">Olá, ${safeName}!</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#64748b;line-height:1.6;">
      Sua conta para <strong style="color:${NAVY};">${safeEmpresa}</strong> foi criada com sucesso.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
      Falta só confirmar o cartão pra começar seus <strong style="color:${NAVY};">14 dias de trial gratuito</strong> — você não é cobrado agora, só no 15º dia, se não cancelar antes.
    </p>
    ${ctaButton(pagamentoUrl, 'Confirmar cartão e começar →')}
    <div style="border-top:1px solid #e5e2da;padding-top:20px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:${NAVY};">Depois de confirmar, seus próximos passos:</p>
      <ul style="margin:0;padding-left:18px;color:#64748b;font-size:14px;line-height:2.2;">
        <li>Convide sua equipe em <strong style="color:${NAVY};">Configurações → Usuários</strong></li>
        <li>Cadastre uma Solução (o que sua empresa vende)</li>
        <li>Cadastre seu primeiro cliente</li>
        <li>Crie uma oportunidade no Pipeline</li>
      </ul>
    </div>`,
    'CRM Studio. · Gerencie suas vendas com inteligência<br>Este é um e-mail automático — não é necessário responder.',
  )
}

// ── QW#4: notificação de reatribuição de processo ────────────────────────────

export async function sendReatribuicaoEmail({
  to,
  nomeAdvogado,
  numeroProcesso,
  assunto,
  processoId,
}: {
  to: string
  nomeAdvogado: string
  numeroProcesso: string
  assunto: string | null
  processoId: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = `${getAppUrl()}/processos/${processoId}`
  const safeNome = escapeHtml(stripHeaders(nomeAdvogado))
  const safeNumero = escapeHtml(stripHeaders(numeroProcesso))

  try {
    await resend.emails.send({
      from: FROM,
      to: stripHeaders(to),
      subject: `Processo atribuído a você: ${numeroProcesso}`,
      html: emailShell(
        'Processo atribuído',
        `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${NAVY};">Olá, ${safeNome}!</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
          Você foi designado(a) como responsável pelo processo abaixo.
          Acesse o CRM para verificar os detalhes e as últimas movimentações.
        </p>
        <div style="background:#f8f7f4;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
          <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Número do processo</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:${NAVY};font-family:monospace;">${safeNumero}</p>
          ${assunto ? `<p style="margin:8px 0 0;font-size:14px;color:#64748b;">${escapeHtml(stripHeaders(assunto))}</p>` : ''}
        </div>
        ${ctaButton(url, 'Ver processo →')}`,
        'CRM Studio. · e-mail automático de atribuição de processo',
      ),
    })
  } catch (err) {
    console.error('[email] falha ao enviar e-mail de reatribuição:', err)
  }
}

// ── QW#1: alerta de novas movimentações DataJud ──────────────────────────────

export async function sendNovasMovimentacoesEmail({
  to,
  nomeAdvogado,
  numeroProcesso,
  assunto,
  qtdNovas,
  processoId,
}: {
  to: string
  nomeAdvogado: string
  numeroProcesso: string
  assunto: string | null
  qtdNovas: number
  processoId: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = `${getAppUrl()}/processos/${processoId}`
  const safeNome = escapeHtml(stripHeaders(nomeAdvogado))
  const safeNumero = escapeHtml(stripHeaders(numeroProcesso))
  const label = qtdNovas === 1 ? '1 nova movimentação' : `${qtdNovas} novas movimentações`

  try {
    await resend.emails.send({
      from: FROM,
      to: stripHeaders(to),
      subject: `[Processo ${numeroProcesso}] ${label} detectada(s)`,
      html: emailShell(
        'Novas movimentações processuais',
        `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${NAVY};">Olá, ${safeNome}!</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
          O DataJud registrou <strong style="color:${NAVY};">${label}</strong> no processo abaixo.
          Acesse o CRM para verificar os detalhes.
        </p>
        <div style="background:#f8f7f4;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
          <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;">Número do processo</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:${NAVY};font-family:monospace;">${safeNumero}</p>
          ${assunto ? `<p style="margin:8px 0 0;font-size:14px;color:#64748b;">${escapeHtml(stripHeaders(assunto))}</p>` : ''}
        </div>
        ${ctaButton(url, 'Ver movimentações →')}`,
        'CRM Studio. · alerta automático de novas movimentações — DataJud',
      ),
    })
  } catch (err) {
    console.error('[email] falha ao enviar alerta de movimentação:', err)
  }
}
