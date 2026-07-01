import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'

const ADMIN_EMAIL = 'edneyjuniords@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Deriva empresa_id, nome e role do servidor — nunca confiar nos valores do cliente
  // maybeSingle() evita 406 quando o perfil ainda não existe (criação de conta em andamento)
  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  // empresa_id é obrigatório para isolar o bug por tenant
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: 'Perfil de usuário não encontrado' }, { status: 403 })
  }

  const body = await req.json() as {
    descricao: string
    screenshot_base64: string | null
    contexto: {
      url: string
      titulo_pagina: string
      user_agent: string
      viewport: string
      empresa_nome: string | null
    }
  }

  const { descricao, screenshot_base64, contexto } = body
  if (!descricao?.trim()) {
    return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })
  }

  // 1. Inserir registro
  const { data: report, error: insertErr } = await admin
    .from('bug_reports')
    .insert({
      empresa_id:   profile?.empresa_id ?? null,
      user_id:      user.id,
      user_name:    profile?.full_name ?? null,
      user_role:    profile?.role ?? null,
      url:          contexto.url,
      descricao:    descricao.trim(),
      contexto: {
        titulo_pagina: contexto.titulo_pagina,
        user_agent:    contexto.user_agent,
        viewport:      contexto.viewport,
        empresa_nome:  contexto.empresa_nome,
      },
      status: 'aberto',
    })
    .select('id')
    .single()

  if (insertErr || !report) {
    return NextResponse.json({ error: 'Falha ao registrar' }, { status: 500 })
  }

  const reportId = report.id

  // 2. Upload screenshot (background — não bloqueia resposta ao usuário)
  let screenshotUrl: string | null = null
  if (screenshot_base64) {
    try {
      const base64Data = screenshot_base64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const path = `${reportId}/screenshot.png`
      const { error: uploadErr } = await admin.storage
        .from('bug-reports')
        .upload(path, buffer, { contentType: 'image/png', upsert: true })
      if (!uploadErr) {
        const { data: { publicUrl } } = admin.storage.from('bug-reports').getPublicUrl(path)
        screenshotUrl = publicUrl
        await admin.from('bug_reports').update({ screenshot_url: screenshotUrl }).eq('id', reportId)
      }
    } catch { /* silencioso — screenshot é opcional */ }
  }

  // 3. Análise Claude (não bloqueia resposta)
  analyzeAndNotify({
    reportId,
    descricao,
    contexto,
    screenshot_base64,
    screenshotUrl,
    userName:  profile?.full_name ?? null,
    userRole:  profile?.role ?? null,
  }).catch(() => {})

  return NextResponse.json({ ok: true, id: reportId })
}

async function analyzeAndNotify(params: {
  reportId: string
  descricao: string
  contexto: Record<string, unknown>
  screenshot_base64: string | null
  screenshotUrl: string | null
  userName: string | null
  userRole: string | null
}) {
  const admin = createAdminClient()
  const { reportId, descricao, contexto, screenshot_base64, userName, userRole } = params

  // Construir mensagem para Claude
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
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = resp.content.find((b) => b.type === 'text')?.text ?? ''
    analise = JSON.parse(text)
    await admin.from('bug_reports').update({ analise_claude: analise }).eq('id', reportId)
  } catch { /* Claude indisponível — relatório fica sem análise */ }

  // 4. Notificar Edney por email
  const sevLabel = analise?.severidade === 'critica' ? '🔴 CRÍTICO'
    : analise?.severidade === 'alta' ? '🟠 Alta'
    : analise?.severidade === 'media' ? '🟡 Média'
    : '🟢 Baixa'

  const screenshotHtml = params.screenshotUrl
    ? `<p><a href="${params.screenshotUrl}">📷 Ver screenshot</a></p>`
    : '<p><em>Sem screenshot.</em></p>'

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'nao-responda@crmstudio.com.br',
    to: ADMIN_EMAIL,
    subject: `[Bug #${reportId.slice(0, 8)}] ${analise?.titulo_curto ?? descricao.slice(0, 60)}`,
    html: `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#14233A">
  <div style="background:#14233A;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#ECEAE3;font-size:18px;font-weight:700">CRM Studio</span><span style="color:#E8915B">.</span>
    <span style="color:#ECEAE3;opacity:.6;font-size:12px;margin-left:12px">Relatório de Bug</span>
  </div>
  <div style="border:1px solid #e5e5e5;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <h2 style="margin:0 0 4px">${analise?.titulo_curto ?? 'Novo bug reportado'}</h2>
    <p style="margin:0;color:#666;font-size:13px">ID: ${reportId} &nbsp;|&nbsp; Severidade: <strong>${sevLabel}</strong></p>
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
  }).catch(() => {})
}
