import { Resend } from 'resend'

// Remetente configurável: em produção use um domínio verificado no Resend.
// Para testar sem verificar domínio, defina EMAIL_FROM='CRM Studio <onboarding@resend.dev>'.
const FROM = process.env.EMAIL_FROM ?? 'CRM Studio <nao-responda@crmstudio.com.br>'

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
  const cor = destaque === 'perigo' ? '#dc2626' : '#d97706'
  const itens = linhas
    .map(
      (l) =>
        `<li style="color:#374151;font-size:14px;line-height:1.9;">${escapeHtml(l)}</li>`,
    )
    .join('')
  const adminUrl = `${getAppUrl()}/admin/empresas`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(titulo)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:${cor};padding:24px 32px;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${escapeHtml(titulo)}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 20px;">${escapeHtml(descricao)}</p>
      <ul style="padding-left:18px;margin:0 0 28px;">${itens}</ul>
      <a href="${adminUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Abrir o Admin &#8594;</a>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">CRM Studio · alerta automático da plataforma</p>
    </div>
  </div>
</body>
</html>`
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
  // linkAcesso é uma URL gerada pelo Supabase (action_link); usar como href.
  const href = encodeURI(linkAcesso)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu acesso ao CRM Studio</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

    <div style="background:#0f172a;padding:32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">CRM Studio</h1>
    </div>

    <div style="padding:40px 32px;">
      <h2 style="color:#111827;font-size:21px;font-weight:600;margin:0 0 8px;">Olá, ${safeName}!</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 28px;">
        Sua conta de acesso para <strong style="color:#111827;">${safeEmpresa}</strong> foi criada.
        Clique no botão abaixo para <strong style="color:#111827;">definir sua senha</strong> e entrar no sistema.
      </p>

      <a href="${href}"
         style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:600;">
        Definir minha senha &#8594;
      </a>

      <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:24px 0 0;">
        Este link é pessoal e expira em 24 horas. Se você não esperava este e-mail, ignore-o.
      </p>
    </div>

    <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
        CRM Studio · Gestão para o seu negócio
      </p>
    </div>

  </div>
</body>
</html>`
}

function buildWelcomeHtml({
  nome,
  empresaNome,
}: {
  nome: string
  empresaNome: string
}): string {
  const dashboardUrl = `${getAppUrl()}/dashboard`
  const safeName = escapeHtml(nome)
  const safeEmpresa = escapeHtml(empresaNome)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao CRM Studio</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

    <div style="background:#0f172a;padding:32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">CRM Studio</h1>
    </div>

    <div style="padding:40px 32px;">
      <h2 style="color:#111827;font-size:21px;font-weight:600;margin:0 0 8px;">Olá, ${safeName}!</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0 0 28px;">
        Sua conta para <strong style="color:#111827;">${safeEmpresa}</strong> foi criada com sucesso.
        Você tem <strong style="color:#111827;">14 dias de trial gratuito</strong> para explorar tudo sem precisar de cartão.
      </p>

      <a href="${dashboardUrl}"
         style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:600;">
        Acessar meu CRM &#8594;
      </a>

      <div style="margin-top:36px;padding-top:24px;border-top:1px solid #f3f4f6;">
        <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 10px;">Próximos passos:</p>
        <ul style="color:#6b7280;font-size:14px;line-height:2;padding-left:18px;margin:0;">
          <li>Convide sua equipe em <strong style="color:#374151;">Configurações &#8594; Usuários</strong></li>
          <li>Cadastre seu primeiro cliente</li>
          <li>Crie uma oportunidade no Pipeline</li>
        </ul>
      </div>
    </div>

    <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
        CRM Studio · Gerencie suas vendas com inteligência<br/>
        Este é um e-mail automático — não é necessário responder.
      </p>
    </div>

  </div>
</body>
</html>`
}
