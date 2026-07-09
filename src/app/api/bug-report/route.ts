import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeAndNotifyBug } from '@/lib/bug-analysis'

// A análise (Claude com imagem) + envio de e-mail agora são aguardados antes
// da resposta (ver comentário abaixo) — folga acima do default da Vercel.
export const maxDuration = 30

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
        // Guarda o PATH (não getPublicUrl): o bucket é privado — screenshot
        // pode capturar dado sensível de cliente na tela. getPublicUrl gera
        // uma URL que nunca funciona pra bucket privado ("Bucket not found"),
        // mas não avisa — ficava quebrado em silêncio. Exibição via signed URL.
        screenshotUrl = path
        await admin.from('bug_reports').update({ screenshot_url: screenshotUrl }).eq('id', reportId)
      }
    } catch { /* silencioso — screenshot é opcional */ }
  }

  // 3. Análise Claude + e-mail. AWAIT de propósito: em serverless (Vercel), uma
  // promise disparada sem await ("fire-and-forget") pode ser morta pela
  // plataforma assim que a resposta HTTP é enviada, ANTES do fetch à Anthropic
  // ou ao Resend terminar — a análise e o e-mail nunca completavam por causa
  // disso, não só pelo model id errado. Aumenta a latência da resposta em
  // alguns segundos, troca aceitável por a análise e o e-mail realmente
  // acontecerem.
  await analyzeAndNotifyBug({
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
