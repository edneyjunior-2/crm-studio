import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sincronizarPublicacoesDJEN } from '@/lib/djen-sync'
import { verificarCronSecret } from '@/lib/cron-auth'

export const maxDuration = 800 // Vercel Pro c/ Fluid Compute — teto GA sem beta (2026-07)

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

  const db = createAdminClient()

  let resultado: Awaited<ReturnType<typeof sincronizarPublicacoesDJEN>>
  try {
    resultado = await sincronizarPublicacoesDJEN(db)
  } catch (err) {
    // Falha em alguma das queries fatais (empresas/advogados/processos ativos) — mesmo 500 de antes.
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({
    publicacoes_novas: resultado.publicacoesNovas,
    advogados_processados: resultado.advogadosProcessados,
    ...(resultado.erros.length ? { erros: resultado.erros } : {}),
  })
}
