import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 300 // 5 min (Vercel Pro)

/**
 * Purga definitiva de contas CANCELADAS após o período de retenção.
 *
 * ⚠️ SEGURANÇA — esta rota APAGA dados de forma irreversível. Travas:
 *  1. Só toca em empresas com status='cancelado' (NUNCA ativo/trial/pendente/etc).
 *  2. Só após RETENCAO_DIAS dias do cancelamento (empresas.cancelado_em).
 *  3. O DELETE é ATÔMICO e auto-guardado: o WHERE repete status+cancelado_em, então
 *     se a conta for reativada na janela (webhook Asaas/admin), casa 0 linhas e não
 *     apaga nada (fecha o TOCTOU). cancelado_em é mantido coerente por trigger no
 *     banco (trg_sync_cancelado_em): reativar limpa o carimbo.
 *  4. Protegida por CRON_SECRET (Bearer, comparação timing-safe).
 *  5. ?dryRun=1 → só relata o que seria apagado, sem apagar nada.
 *
 * Ao apagar a empresa, o ON DELETE CASCADE (migration 20260619210000) remove todos
 * os dados do tenant. Usuários do Supabase Auth (sem FK p/ empresas) são removidos
 * à parte via admin API — só quando o DELETE da empresa de fato ocorreu.
 */
const RETENCAO_DIAS = 90

function secretValido(authHeader: string): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const esperado = createHash('sha256').update(`Bearer ${secret}`).digest()
  const recebido = createHash('sha256').update(authHeader).digest()
  return timingSafeEqual(esperado, recebido)
}

export async function GET(req: NextRequest) {
  return handler(req)
}
export async function POST(req: NextRequest) {
  return handler(req)
}

async function handler(req: NextRequest) {
  // Trava 4: secret (timing-safe)
  if (!secretValido(req.headers.get('authorization') ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const db = createAdminClient()

  // Corte de retenção: cancelado há mais de RETENCAO_DIAS dias.
  const corte = new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString()

  // Travas 1 + 2: só canceladas, com carimbo, além do corte. Mais antigas primeiro.
  const { data: candidatas, error: selErr } = await db
    .from('empresas')
    .select('id, nome, cancelado_em')
    .eq('status', 'cancelado')
    .not('cancelado_em', 'is', null)
    .lt('cancelado_em', corte)
    .order('cancelado_em', { ascending: true })

  if (selErr) {
    console.error('purgar-canceladas: erro no select de candidatas:', selErr.message)
    return NextResponse.json({ error: 'Falha ao consultar empresas.' }, { status: 500 })
  }

  const elegiveis = candidatas ?? []
  const detalhes: Array<Record<string, unknown>> = []
  let purgadas = 0
  let usuariosRemovidos = 0

  for (const emp of elegiveis) {
    // Coleta os usuários do Auth ANTES de apagar (os profiles somem no cascade).
    const { data: perfis } = await db.from('profiles').select('id').eq('empresa_id', emp.id)
    const userIds = (perfis ?? []).map((p) => p.id as string)

    if (dryRun) {
      detalhes.push({ id: emp.id, acao: 'dry-run', cancelado_em: emp.cancelado_em, usuarios: userIds.length })
      continue
    }

    // Trava 3 — DELETE ATÔMICO E AUTO-GUARDADO: as condições estão no próprio WHERE,
    // reavaliadas pelo Postgres no instante do delete. Se a conta foi reativada na
    // janela, casa 0 linhas (status mudou e/ou cancelado_em foi limpo pelo trigger).
    const { data: apagadas, error: delErr } = await db
      .from('empresas')
      .delete()
      .eq('id', emp.id)
      .eq('status', 'cancelado')
      .not('cancelado_em', 'is', null)
      .lt('cancelado_em', corte)
      .select('id')

    if (delErr) {
      console.error(`purgar-canceladas: erro ao apagar empresa ${emp.id}:`, delErr.message)
      detalhes.push({ id: emp.id, acao: 'erro' })
      continue
    }

    if (!apagadas || apagadas.length === 0) {
      // Reativada/alterada na janela → não apaga nada nem mexe nos usuários.
      detalhes.push({ id: emp.id, acao: 'pulada', motivo: 'status mudou na janela (corrida)' })
      continue
    }
    purgadas++

    // Só agora (empresa de fato apagada) remove os usuários órfãos do Auth.
    for (const uid of userIds) {
      const { error: authErr } = await db.auth.admin.deleteUser(uid)
      if (authErr) {
        console.error(`purgar-canceladas: usuário Auth órfão ${uid} (empresa ${emp.id}):`, authErr.message)
        detalhes.push({ id: emp.id, acao: 'auth_warn', userId: uid })
      } else {
        usuariosRemovidos++
      }
    }

    detalhes.push({ id: emp.id, acao: 'purgada', usuarios: userIds.length })
  }

  return NextResponse.json({
    dryRun,
    retencao_dias: RETENCAO_DIAS,
    corte,
    elegiveis: elegiveis.length,
    purgadas,
    usuarios_removidos: usuariosRemovidos,
    detalhes,
  })
}
