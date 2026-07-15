import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sincronizarPublicacoesDJEN } from '@/lib/djen-sync'
import { verificarCronSecret } from '@/lib/cron-auth'
import { registrarExecucaoCron } from '@/lib/cron-execucoes'
import { pingHealthcheck } from '@/lib/healthcheck-ping'

export const maxDuration = 800 // Vercel Pro c/ Fluid Compute — teto GA sem beta (2026-07)
// API pública do CNJ bloqueia (403) requests de datacenter fora do Brasil —
// fixa a região da function em São Paulo para não cair nesse bloqueio.
export const preferredRegion = 'gru1'

// Vercel Cron invoca via GET; POST permite trigger manual autenticado
export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

// Wrapper fino: auth do cron + chamada à lib (src/lib/djen-sync.ts) + JSON no
// mesmo formato de sempre. Miolo (busca de advogados, loop DJEN, upsert,
// e-mails) mora na lib — reaproveitado também pelo botão de admin (ver spec
// admin-sincronizar-processos-botao.md).
async function handler(req: NextRequest) {
  // Proteção por secret (comparação timing-safe — ver src/lib/cron-auth.ts)
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Observabilidade (spec vigias-cron-sincronizacao.md) — fire-and-forget,
  // nunca lança nem atrasa a sincronização real abaixo.
  pingHealthcheck('HEALTHCHECKS_URL_DJEN')

  const db = createAdminClient()

  let resultado: Awaited<ReturnType<typeof sincronizarPublicacoesDJEN>>
  try {
    resultado = await sincronizarPublicacoesDJEN(db)
  } catch (err) {
    // Falha em alguma das queries fatais (empresas/advogados/processos ativos) — mesmo 500 de antes.
    const msg = err instanceof Error ? err.message : String(err)
    await registrarExecucaoCron(db, 'publicacoes-djen', false, { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // DJEN não tem o conceito de falha "auth:" fatal-mas-200 do DataJud — sucesso
  // aqui é sempre ok: true, mesmo quando há erros parciais no array abaixo.
  await registrarExecucaoCron(db, 'publicacoes-djen', true, {
    publicacoes_novas: resultado.publicacoesNovas,
    advogados_processados: resultado.advogadosProcessados,
    erros: resultado.erros,
  })

  return NextResponse.json({
    publicacoes_novas: resultado.publicacoesNovas,
    advogados_processados: resultado.advogadosProcessados,
    ...(resultado.erros.length ? { erros: resultado.erros } : {}),
  })
}
