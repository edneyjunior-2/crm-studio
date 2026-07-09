'use server'

import { revalidatePath } from 'next/cache'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { notificarReporteResolvido } from '@/lib/bug-analysis'

// Vocabulário desta tela (page.tsx STATUS_LABELS / bug-detail-panel.tsx
// STATUS_OPTIONS) — não confundir com o vocabulário diferente usado por
// /api/admin/bugs/[id]/trigger (aberto|em_analise|corrigido|fechado|wont_fix).
const STATUS_PERMITIDOS = ['aberto', 'em_analise', 'resolvido', 'ignorado'] as const
type BugStatus = typeof STATUS_PERMITIDOS[number]

export async function atualizarStatusBug(bugId: string, status: string): Promise<{ error?: string }> {
  await getAuthPlatformAdmin()

  if (!STATUS_PERMITIDOS.includes(status as BugStatus)) {
    return { error: `Status inválido. Permitidos: ${STATUS_PERMITIDOS.join(', ')}` }
  }

  const admin = createAdminClient()

  // Busca o estado atual ANTES de atualizar — só notifica o autor na
  // transição PRA 'resolvido' (evita reenviar e-mail se o admin alternar o
  // status várias vezes ou já estava resolvido).
  const { data: atual } = await admin
    .from('bug_reports')
    .select('status, descricao, user_id, user_name')
    .eq('id', bugId)
    .maybeSingle()

  const { error } = await admin
    .from('bug_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bugId)

  if (error) return { error: error.message }

  if (status === 'resolvido' && atual && atual.status !== 'resolvido' && atual.user_id) {
    await notificarReporteResolvido({
      reportId: bugId,
      descricao: atual.descricao,
      userId:    atual.user_id,
      userName:  atual.user_name,
    }).catch(() => {})
  }

  revalidatePath('/admin/bugs')
  return {}
}
