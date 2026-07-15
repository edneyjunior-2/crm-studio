import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarCronSecret } from '@/lib/cron-auth'
import { ultimaExecucaoCron, type CronSlug } from '@/lib/cron-execucoes'
import { sendAlertaInterno } from '@/lib/email'

export const maxDuration = 30

// Spec: .claude/specs/vigias-cron-sincronizacao.md
//
// Vigia diário: detecta se os crons de sincronização de processos
// (atualizar-processos/DataJud e publicacoes-djen/DJEN) rodaram e tiveram
// sucesso, avisando por e-mail quando não. Roda TODO DIA (ver vercel.json) —
// inclusive sexta/sábado, quando os crons principais NÃO rodam de propósito
// (vercel.json: "*/15 3-10 * * 0-4", domingo-quinta) — porque é exatamente
// nesses dias que a "janela esperada" abaixo precisa olhar pra trás até a
// quinta mais recente, para não disparar alarme falso.
const ALERTA_EMAIL = process.env.ALERTA_EMAIL ?? 'edneyjuniords@gmail.com'
const DIAS_ATIVOS = new Set([0, 1, 2, 3, 4]) // domingo-quinta — mesmo conjunto do vercel.json

/**
 * Início da última janela em que os crons de sincronização deveriam ter rodado,
 * dado o momento atual. Anda pra trás dia a dia até achar um dia ativo cujo
 * início de janela (3h UTC) já passou — cobre corretamente sexta/sábado
 * (que apontam de volta pra quinta) sem alarme falso.
 */
function inicioDaJanelaEsperada(agora: Date): Date {
  const d = new Date(agora)
  for (let i = 0; i < 8; i++) {
    if (DIAS_ATIVOS.has(d.getUTCDay())) {
      d.setUTCHours(3, 0, 0, 0)
      if (d.getTime() <= agora.getTime()) return d
    }
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return new Date(agora.getTime() - 26 * 60 * 60 * 1000) // fallback, não deveria ser alcançado
}

// Vercel Cron invoca via GET; POST permite trigger manual autenticado
export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

async function handler(req: NextRequest) {
  // Proteção por secret (comparação timing-safe — ver src/lib/cron-auth.ts).
  // Sem isso seria uma rota pública disparando e-mail pro dono sob demanda.
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const cutoff = inicioDaJanelaEsperada(new Date())
  const alertas: string[] = []

  for (const slug of ['atualizar-processos', 'publicacoes-djen'] as CronSlug[]) {
    const ultima = await ultimaExecucaoCron(db, slug)
    if (!ultima || new Date(ultima.executado_em) < cutoff) {
      alertas.push(
        `${slug}: NÃO rodou desde ${cutoff.toISOString()} — Vercel pode ter falhado em disparar, ou o cron travou.`,
      )
    } else if (!ultima.ok) {
      alertas.push(`${slug}: rodou às ${ultima.executado_em} mas com FALHA — ${JSON.stringify(ultima.resumo)}`)
    } else {
      const erros = (ultima.resumo as { erros?: string[] })?.erros
      if (erros && erros.length > 0) {
        alertas.push(`${slug}: rodou às ${ultima.executado_em} com ${erros.length} erro(s) parciais — verifique eventos_webhook/logs.`)
      }
    }
  }

  if (alertas.length > 0) {
    await sendAlertaInterno({
      to:        ALERTA_EMAIL,
      assunto:   '[CRM Studio] Vigia: possível falha nos crons de sincronização',
      titulo:    'Sincronização de processos pode estar parada',
      descricao: 'O vigia diário encontrou pelo menos um cron sem execução saudável na janela esperada.',
      linhas:    alertas,
      destaque:  'perigo',
    }).catch((e: unknown) => console.error('[watchdog] falha ao enviar alerta:', e))
  }

  return NextResponse.json({ ok: true, alertas: alertas.length })
}
