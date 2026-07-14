import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sincronizarMovimentacoesDataJud } from '@/lib/datajud-sync'
import { verificarCronSecret } from '@/lib/cron-auth'

export const maxDuration = 800 // Vercel Pro c/ Fluid Compute — teto GA sem beta (2026-07)

// Vercel Cron invoca via GET; POST permite trigger manual autenticado
export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

// Wrapper fino: auth do cron + chamada à lib (src/lib/datajud-sync.ts) + JSON
// no mesmo formato de sempre. Miolo (busca em lote, dedup, carimbo, e-mails)
// mora na lib — reaproveitado também pelo botão de admin (ver spec
// admin-sincronizar-processos-botao.md).
async function handler(req: NextRequest) {
  // Proteção por secret (comparação timing-safe — ver src/lib/cron-auth.ts)
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  let resultado: Awaited<ReturnType<typeof sincronizarMovimentacoesDataJud>>
  try {
    resultado = await sincronizarMovimentacoesDataJud(db)
  } catch (err) {
    // Falha ao buscar os processos (query fatal) — mesmo 500 de antes.
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // A lib empurra um erro com prefixo 'auth:' quando a chave do DataJud está
  // inválida/sem acesso — interrompe tudo (ver comentário em datajud-sync.ts).
  // Traduz de volta pro mesmo 502 que a rota devolvia antes do refactor.
  if (resultado.erros.some((e) => e.startsWith('auth:'))) {
    return NextResponse.json(
      {
        error:               'DataJud: falha de autenticação (verifique DATAJUD_API_KEY)',
        atualizados:         resultado.atualizados,
        novas_movimentacoes: resultado.novasMovimentacoes,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    atualizados: resultado.atualizados,
    novas_movimentacoes: resultado.novasMovimentacoes,
    ...(resultado.erros.length ? { erros: resultado.erros } : {}),
  })
}
