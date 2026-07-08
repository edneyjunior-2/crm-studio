import { NextRequest, NextResponse } from 'next/server'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeAndNotifyBug } from '@/lib/bug-analysis'

// Mesma folga do envio original — a análise (Claude) + e-mail são aguardados.
export const maxDuration = 30

/**
 * Reanalisa um bug já registrado (ex.: reportado antes da análise automática
 * funcionar corretamente — ver commit e1ce22b). Reconstrói o mesmo payload
 * que o envio original monta, a partir do que já está salvo no banco, e
 * baixa o screenshot do Storage (se houver) pra reenviar como imagem à
 * Claude — a análise original só tinha o base64 em memória, que não fica
 * persistido; buscamos de volta pela URL pública do bucket.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getAuthPlatformAdmin()
  const { id } = await params

  const admin = createAdminClient()
  const { data: bug, error } = await admin
    .from('bug_reports')
    .select('id, descricao, url, contexto, screenshot_url, user_name, user_role')
    .eq('id', id)
    .maybeSingle()

  if (error || !bug) {
    return NextResponse.json({ error: 'Bug não encontrado' }, { status: 404 })
  }

  let screenshot_base64: string | null = null
  if (bug.screenshot_url) {
    try {
      const res = await fetch(bug.screenshot_url)
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer())
        screenshot_base64 = `data:image/png;base64,${buffer.toString('base64')}`
      }
    } catch (err) {
      console.error('[reanalyze] falha ao baixar screenshot existente:', err)
      // segue sem imagem — análise só de texto é melhor que nenhuma
    }
  }

  const contexto = {
    url: bug.url,
    ...(bug.contexto as Record<string, unknown> ?? {}),
  }

  await analyzeAndNotifyBug({
    reportId: bug.id,
    descricao: bug.descricao,
    contexto,
    screenshot_base64,
    screenshotUrl: bug.screenshot_url,
    userName: bug.user_name,
    userRole: bug.user_role,
  })

  return NextResponse.json({ ok: true })
}
