import { NextResponse } from 'next/server'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sincronizarMovimentacoesDataJud } from '@/lib/datajud-sync'
import { sincronizarPublicacoesDJEN } from '@/lib/djen-sync'

export const maxDuration = 800 // mesmo teto dos crons — as 2 syncs rodam em sequência aqui

// Limite alto: o clique dispara pra TODOS os tenants de uma vez e deve drenar
// o backlog inteiro (cobre com folga o total atual de processos — ver spec
// admin-sincronizar-processos-botao.md).
const LIMITE_ADMIN = 1000

type ResultadoMovimentacoes = { atualizados: number; novasMovimentacoes: number; erros: string[] }
type ResultadoPublicacoes = { advogadosProcessados: number; publicacoesNovas: number; erros: string[] }

/**
 * Dispara manualmente as 2 sincronizações de processos jurídicos (DataJud +
 * DJEN) para TODOS os clientes, sem depender do CRON_SECRET — só a sessão de
 * platform-admin. Gate igual às outras rotas /api/admin/* (ex.:
 * src/app/api/admin/bugs/[id]/reanalyze/route.ts): chama
 * `getAuthPlatformAdmin()` direto — ela mesma faz o redirect quando o usuário
 * não é platform-admin.
 */
export async function POST() {
  await getAuthPlatformAdmin()

  const db = createAdminClient()

  // Sequencial (não Promise.all) — evita competir por rate limit das APIs
  // externas (DataJud e DJEN). Erros de uma não impedem a outra.
  let movimentacoes: ResultadoMovimentacoes
  try {
    const r = await sincronizarMovimentacoesDataJud(db, { limite: LIMITE_ADMIN })
    movimentacoes = { atualizados: r.atualizados, novasMovimentacoes: r.novasMovimentacoes, erros: r.erros }
  } catch (err) {
    movimentacoes = {
      atualizados: 0,
      novasMovimentacoes: 0,
      erros: [err instanceof Error ? err.message : String(err)],
    }
  }

  let publicacoes: ResultadoPublicacoes
  try {
    const r = await sincronizarPublicacoesDJEN(db)
    publicacoes = { advogadosProcessados: r.advogadosProcessados, publicacoesNovas: r.publicacoesNovas, erros: r.erros }
  } catch (err) {
    publicacoes = {
      advogadosProcessados: 0,
      publicacoesNovas: 0,
      erros: [err instanceof Error ? err.message : String(err)],
    }
  }

  return NextResponse.json({ movimentacoes, publicacoes })
}
