import type { createAdminClient } from '@/lib/supabase/admin'

export type CronSlug = 'atualizar-processos' | 'publicacoes-djen'

/** Best-effort: nunca lança — registrar a execução não pode derrubar o cron em si. */
export async function registrarExecucaoCron(
  db: ReturnType<typeof createAdminClient>,
  slug: CronSlug,
  ok: boolean,
  resumo: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await db.from('cron_execucoes').insert({ cron_slug: slug, ok, resumo })
    if (error) console.error(`[cron-execucoes] falha ao registrar execução de ${slug}:`, error.message)
  } catch (e) {
    console.error(`[cron-execucoes] exceção ao registrar execução de ${slug}:`, e)
  }
}

/** Best-effort: nunca lança — usada pelo vigia, que não pode cair por causa desta leitura. */
export async function ultimaExecucaoCron(
  db: ReturnType<typeof createAdminClient>,
  slug: CronSlug,
): Promise<{ executado_em: string; ok: boolean; resumo: Record<string, unknown> } | null> {
  try {
    const { data, error } = await db
      .from('cron_execucoes')
      .select('executado_em, ok, resumo')
      .eq('cron_slug', slug)
      .order('executado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error(`[cron-execucoes] falha ao ler última execução de ${slug}:`, error.message)
      return null
    }
    return data
  } catch (e) {
    console.error(`[cron-execucoes] exceção ao ler última execução de ${slug}:`, e)
    return null
  }
}
