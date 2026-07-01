import { NextRequest, NextResponse } from 'next/server'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const GITHUB_OWNER = 'edneyjunior-2'
const GITHUB_REPO  = 'crm-studio'
const WORKFLOW_ID  = 'fix-bug.yml'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getAuthPlatformAdmin()
  const { id } = await params
  const { prompt } = await req.json() as { prompt: string }

  const token = process.env.GITHUB_PAT
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_PAT não configurado no servidor.' }, { status: 500 })
  }

  // Disparar workflow no GitHub Actions
  const ghRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          bug_id:  id,
          prompt:  prompt.slice(0, 65_000), // GitHub limita inputs a 65kb
        },
      }),
    }
  )

  if (!ghRes.ok) {
    const err = await ghRes.text()
    return NextResponse.json({ error: `GitHub API: ${err}` }, { status: 502 })
  }

  // Atualizar status no banco
  const admin = createAdminClient()
  await admin
    .from('bug_reports')
    .update({ status: 'em_analise', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}

const BUG_STATUS_PERMITIDOS = ['aberto', 'em_analise', 'corrigido', 'fechado', 'wont_fix'] as const
type BugStatus = typeof BUG_STATUS_PERMITIDOS[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getAuthPlatformAdmin()
  const { id } = await params
  const { status } = await req.json() as { status: string }

  if (!BUG_STATUS_PERMITIDOS.includes(status as BugStatus)) {
    return NextResponse.json(
      { error: `Status inválido. Permitidos: ${BUG_STATUS_PERMITIDOS.join(', ')}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  await admin
    .from('bug_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
