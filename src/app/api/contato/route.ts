import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const contatoSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(255),
  email: z.string().email('E-mail inválido').max(255),
  empresa: z.string().max(255).optional().default(''),
  assunto: z.string().max(255).optional().default('Contato'),
  mensagem: z.string().min(1, 'Mensagem obrigatória').max(5000),
})

const FROM = process.env.EMAIL_FROM ?? 'CRM Studio <nao-responda@crmstudio.com.br>'
const PARA = process.env.CONTATO_EMAIL ?? 'edneyjuniords@gmail.com'

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email não configurado no servidor' }, { status: 503 })
  }

  // Anti-spam: 5 envios/hora por IP
  const ip = clientIp(req.headers)
  if (!(await rateLimit(`contato:${ip}`, 5, 3600))) {
    return NextResponse.json({ error: 'Muitas mensagens em pouco tempo. Tente novamente mais tarde.' }, { status: 429 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = contatoSchema.safeParse(rawBody)
  if (!parsed.success) {
    const mensagem = parsed.error.issues[0]?.message ?? 'Dados inválidos'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }

  const { nome, email, empresa, assunto, mensagem } = parsed.data

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: PARA,
      replyTo: email.trim(),
      subject: `[Contato CRM Studio] ${assunto} — ${nome.trim()}`,
      html: buildHtml({ nome: nome.trim(), email: email.trim(), empresa, assunto, mensagem: mensagem.trim() }),
    })
    if (error) {
      console.error('[api/contato] Resend recusou:', error)
      return NextResponse.json({ error: 'Falha ao enviar e-mail' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/contato] Exceção:', err)
    return NextResponse.json({ error: 'Falha ao enviar e-mail' }, { status: 500 })
  }
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHtml({ nome, email, empresa, assunto, mensagem }: {
  nome: string; email: string; empresa: string; assunto: string; mensagem: string
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Novo contato</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:40px 0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:20px 28px;">
      <h1 style="color:#ffffff;margin:0;font-size:16px;font-weight:700;">Novo contato — CRM Studio</h1>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
        <tr><td style="padding:5px 0;color:#6b7280;width:28%;vertical-align:top">Assunto</td><td style="padding:5px 0;font-weight:600">${esc(assunto)}</td></tr>
        <tr><td style="padding:5px 0;color:#6b7280;vertical-align:top">Nome</td><td style="padding:5px 0">${esc(nome)}</td></tr>
        <tr><td style="padding:5px 0;color:#6b7280;vertical-align:top">E-mail</td><td style="padding:5px 0"><a href="mailto:${esc(email)}" style="color:#4f46e5">${esc(email)}</a></td></tr>
        ${empresa ? `<tr><td style="padding:5px 0;color:#6b7280;vertical-align:top">Empresa</td><td style="padding:5px 0">${esc(empresa)}</td></tr>` : ''}
      </table>
      <hr style="margin:20px 0;border:none;border-top:1px solid #f3f4f6;" />
      <p style="color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;margin:0">${esc(mensagem)}</p>
    </div>
    <div style="background:#f9fafb;padding:14px 28px;text-align:center;border-top:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0">CRM Studio · formulário de contato do site</p>
    </div>
  </div>
</body>
</html>`
}
