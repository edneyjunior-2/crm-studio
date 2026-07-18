import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarCronSecret } from '@/lib/cron-auth'
import { sendAlertaInterno } from '@/lib/email'
import { computarSensores } from '@/lib/monitoramento'

/**
 * Monitor da EJLABS — "cérebro" do sistema de observabilidade interna.
 * Spec: .claude/specs/monitor-ejlabs-sensores-cron.md
 *
 * A cada execução (10 em 10min, ver vercel.json), recomputa TODOS os sensores
 * a partir das tabelas de origem (computarSensores) e grava o resultado em
 * `monitoramento_status` (upsert, uma linha por chave). O painel admin e o
 * endpoint do widget do Mac (outros streams) só LEEM essa tabela — não
 * recomputam nada.
 *
 * Alerta por e-mail só quando um sensor MUDA para fora de 'ok' (1ª detecção)
 * ou quando já se passaram 2h desde o último alerta pra aquele sensor (evita
 * spam a cada 10min enquanto o problema persiste).
 */
export const maxDuration = 60

// Vercel Cron invoca via GET; POST permite trigger manual autenticado
export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

async function handler(req: NextRequest) {
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createAdminClient()
  const sensores = await computarSensores(db)

  const alertasParaEnviar: string[] = []

  for (const s of sensores) {
    const { data: anterior } = await db
      .from('monitoramento_status')
      .select('status, desde, ultimo_alerta_em')
      .eq('chave', s.chave)
      .maybeSingle()

    const eraOk = !anterior || anterior.status === 'ok'
    const agoraOk = s.status === 'ok'
    const desde = agoraOk ? null : (eraOk ? new Date().toISOString() : anterior!.desde)

    const duasHorasSemAlerta =
      !anterior?.ultimo_alerta_em || (Date.now() - new Date(anterior.ultimo_alerta_em).getTime()) > 2 * 60 * 60 * 1000
    const devealertar = !agoraOk && ((eraOk && !agoraOk) || duasHorasSemAlerta)

    await db.from('monitoramento_status').upsert({
      chave: s.chave,
      nome: s.nome,
      area: s.area,
      status: s.status,
      detalhe: s.detalhe,
      desde,
      ultimo_alerta_em: devealertar ? new Date().toISOString() : anterior?.ultimo_alerta_em ?? null,
      atualizado_em: new Date().toISOString(),
    })

    if (devealertar) {
      alertasParaEnviar.push(`[${s.area}] ${s.nome} (${s.status}): ${s.detalhe}`)
    }
  }

  if (alertasParaEnviar.length > 0) {
    await sendAlertaInterno({
      to: process.env.ALERTA_EMAIL ?? 'edneyjuniords@gmail.com',
      assunto: `[Monitor da EJLABS] ${alertasParaEnviar.length} sensor(es) com problema`,
      titulo: 'Monitor da EJLABS detectou um problema',
      descricao: 'O cron de monitoramento encontrou pelo menos um sensor fora do estado OK.',
      linhas: alertasParaEnviar,
      destaque: 'perigo',
    }).catch((e: unknown) => console.error('[monitor-ejlabs] falha ao enviar alerta:', e))
  }

  return NextResponse.json({ ok: true, sensores: sensores.length, alertas: alertasParaEnviar.length })
}
