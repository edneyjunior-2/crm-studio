import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAlertaInterno } from '@/lib/email'
import { verificarCronSecret } from '@/lib/cron-auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

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
 *
 * Arquivos no Supabase Storage (contratos, comprovantes, documentos de processos e
 * de RH/colaboradores — muitos sensíveis para fins de LGPD) NÃO têm FK para
 * `empresas` e por isso NÃO são removidos pelo CASCADE. São coletados ANTES do
 * DELETE (as linhas que guardam o caminho somem no cascade) e removidos do Storage
 * best-effort logo após a exclusão confirmada da empresa — falha ao apagar do
 * Storage é logada mas NUNCA bloqueia a purga do banco.
 */
const RETENCAO_DIAS = 90
// Quantos dias antes da purga o dono é avisado (p/ ter chance de reverter).
const AVISO_DIAS = 7
// Para onde vão os alertas internos (dono da plataforma). Configurável por env.
const ALERTA_EMAIL = process.env.ALERTA_EMAIL ?? 'edneyjuniords@gmail.com'

type AdminClient = ReturnType<typeof createAdminClient>
type ArquivosPorBucket = Record<string, string[]>

// Buckets tocados por dados de tenant (nomes literais — ver migrations
// 003_contrato_storage, 20260602100000_comprovante_pagamento,
// 20260624000002_processos_documentos_ged, 20260614180000_rh_documentos,
// 20260629190000_contratos_whitelabel).
const BUCKET_CONTRATOS = 'contratos'
const BUCKET_COMPROVANTES = 'comprovantes'
const BUCKET_PROCESSOS_DOCS = 'processos-docs'
const BUCKET_RH_DOCUMENTOS = 'rh-documentos'
const BUCKET_CONTRATO_TEMPLATES = 'contrato-templates'

/**
 * Lista os caminhos de Storage pertencentes à empresa ANTES da exclusão do banco
 * (as tabelas que guardam o caminho — parceiros, contas_pagar, processos_documentos,
 * colaborador_documentos, pontos — somem no CASCADE). Best-effort por tabela: erro
 * numa não impede a coleta das demais.
 */
async function coletarArquivosStorage(db: AdminClient, empresaId: string): Promise<ArquivosPorBucket> {
  const arquivos: ArquivosPorBucket = {
    [BUCKET_CONTRATOS]: [],
    [BUCKET_COMPROVANTES]: [],
    [BUCKET_PROCESSOS_DOCS]: [],
    [BUCKET_RH_DOCUMENTOS]: [],
    // Caminho determinístico (<empresa_id>/index.html) — tenta remover mesmo sem
    // certeza de que existe; remove() em caminho inexistente não é erro.
    [BUCKET_CONTRATO_TEMPLATES]: [`${empresaId}/index.html`],
  }

  try {
    const { data } = await db
      .from('parceiros')
      .select('contrato_url')
      .eq('empresa_id', empresaId)
      .not('contrato_url', 'is', null)
    for (const row of data ?? []) {
      if (row.contrato_url) arquivos[BUCKET_CONTRATOS].push(row.contrato_url as string)
    }
  } catch (e) {
    console.error(`purgar-canceladas: falha ao coletar contratos (empresa ${empresaId}):`, e)
  }

  try {
    const { data } = await db
      .from('contas_pagar')
      .select('comprovante_url')
      .eq('empresa_id', empresaId)
      .not('comprovante_url', 'is', null)
    for (const row of data ?? []) {
      if (row.comprovante_url) arquivos[BUCKET_COMPROVANTES].push(row.comprovante_url as string)
    }
  } catch (e) {
    console.error(`purgar-canceladas: falha ao coletar comprovantes (empresa ${empresaId}):`, e)
  }

  try {
    // fetchAllRows contorna o cap de 1000 linhas do PostgREST (tenants grandes).
    const docs = await fetchAllRows<{ storage_path: string | null }>((from, to) =>
      db.from('processos_documentos').select('storage_path').eq('empresa_id', empresaId).range(from, to),
    )
    for (const row of docs) if (row.storage_path) arquivos[BUCKET_PROCESSOS_DOCS].push(row.storage_path)
  } catch (e) {
    console.error(`purgar-canceladas: falha ao coletar documentos de processos (empresa ${empresaId}):`, e)
  }

  try {
    const docs = await fetchAllRows<{ storage_path: string | null }>((from, to) =>
      db.from('colaborador_documentos').select('storage_path').eq('empresa_id', empresaId).range(from, to),
    )
    for (const row of docs) if (row.storage_path) arquivos[BUCKET_RH_DOCUMENTOS].push(row.storage_path)
  } catch (e) {
    console.error(`purgar-canceladas: falha ao coletar documentos de RH (empresa ${empresaId}):`, e)
  }

  try {
    const { data } = await db
      .from('pontos')
      .select('documento_path')
      .eq('empresa_id', empresaId)
      .not('documento_path', 'is', null)
    for (const row of data ?? []) {
      if (row.documento_path) arquivos[BUCKET_RH_DOCUMENTOS].push(row.documento_path as string)
    }
  } catch (e) {
    console.error(`purgar-canceladas: falha ao coletar atestados de ponto (empresa ${empresaId}):`, e)
  }

  return arquivos
}

/**
 * Remove do Storage os arquivos já coletados, bucket a bucket e em lotes de 100.
 * Best-effort: nunca lança — erro é logado e a purga do banco (já concluída a esta
 * altura) segue normalmente. Retorna o total de arquivos efetivamente removidos.
 */
async function removerArquivosStorage(db: AdminClient, arquivos: ArquivosPorBucket): Promise<number> {
  let total = 0
  for (const [bucket, paths] of Object.entries(arquivos)) {
    if (paths.length === 0) continue
    for (let i = 0; i < paths.length; i += 100) {
      const lote = paths.slice(i, i + 100)
      try {
        const { data, error } = await db.storage.from(bucket).remove(lote)
        if (error) {
          console.error(`purgar-canceladas: erro ao remover arquivos do bucket ${bucket}:`, error.message)
          continue
        }
        total += data?.length ?? 0
      } catch (e) {
        console.error(`purgar-canceladas: exceção ao remover arquivos do bucket ${bucket}:`, e)
      }
    }
  }
  return total
}

export async function GET(req: NextRequest) {
  return handler(req)
}
export async function POST(req: NextRequest) {
  return handler(req)
}

async function handler(req: NextRequest) {
  // Trava 4: secret (timing-safe — ver src/lib/cron-auth.ts)
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const db = createAdminClient()

  // Corte de retenção: cancelado há mais de RETENCAO_DIAS dias.
  const corte = new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString()

  // ---- FASE A: aviso prévio (para o dono tentar reverter ANTES da exclusão) ----
  // Contas canceladas que entram nos últimos AVISO_DIAS antes do prazo e que ainda
  // não foram avisadas. O carimbo aviso_purga_enviado_em garante 1 aviso por conta
  // (e o trigger o zera na reativação, então re-cancelar volta a avisar).
  const corteAviso = new Date(Date.now() - (RETENCAO_DIAS - AVISO_DIAS) * 24 * 60 * 60 * 1000).toISOString()
  let avisados = 0
  const { data: proximas } = await db
    .from('empresas')
    .select('id, nome, cancelado_em')
    .eq('status', 'cancelado')
    .not('cancelado_em', 'is', null)
    .gte('cancelado_em', corte)       // ainda dentro dos 90 dias
    .lt('cancelado_em', corteAviso)   // mas já nos últimos AVISO_DIAS
    .is('aviso_purga_enviado_em', null)
    .order('cancelado_em', { ascending: true })

  if (proximas && proximas.length > 0) {
    const linhas = proximas.map((e) => {
      const fim = new Date(new Date(e.cancelado_em as string).getTime() + RETENCAO_DIAS * 86400000)
      const dias = Math.max(0, Math.ceil((fim.getTime() - Date.now()) / 86400000))
      return `${(e.nome as string) ?? e.id} — será apagada em ${dias} dia(s), em ${fim.toLocaleDateString('pt-BR')}. Reative para manter.`
    })
    if (!dryRun) {
      await sendAlertaInterno({
        to: ALERTA_EMAIL,
        assunto: `⚠️ ${proximas.length} conta(s) cancelada(s) perto da exclusão definitiva`,
        titulo: 'Contas perto da purga (90 dias)',
        descricao: 'Estas contas canceladas serão APAGADAS definitivamente em breve (irreversível). Se quiser manter alguma, reative a conta no Admin antes do prazo.',
        linhas,
        destaque: 'aviso',
      })
      await db
        .from('empresas')
        .update({ aviso_purga_enviado_em: new Date().toISOString() })
        .in('id', proximas.map((e) => e.id))
    }
    avisados = proximas.length
  }

  // ---- FASE B: purga ----
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
  let arquivosRemovidosTotal = 0

  for (const emp of elegiveis) {
    // Coleta os usuários do Auth ANTES de apagar (os profiles somem no cascade).
    const { data: perfis } = await db.from('profiles').select('id').eq('empresa_id', emp.id)
    const userIds = (perfis ?? []).map((p) => p.id as string)

    if (dryRun) {
      detalhes.push({ id: emp.id, acao: 'dry-run', cancelado_em: emp.cancelado_em, usuarios: userIds.length })
      continue
    }

    // Coleta os caminhos de Storage ANTES de apagar (as linhas que os guardam
    // somem no cascade) — best-effort, não impede a purga se falhar.
    const arquivosStorage = await coletarArquivosStorage(db, emp.id as string)

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

    // Só agora (empresa de fato apagada) remove os arquivos órfãos do Storage.
    // Best-effort: NUNCA bloqueia a purga (já concluída no banco) se o Storage falhar.
    const arquivosRemovidos = await removerArquivosStorage(db, arquivosStorage)
    arquivosRemovidosTotal += arquivosRemovidos

    // E remove os usuários órfãos do Auth.
    for (const uid of userIds) {
      const { error: authErr } = await db.auth.admin.deleteUser(uid)
      if (authErr) {
        console.error(`purgar-canceladas: usuário Auth órfão ${uid} (empresa ${emp.id}):`, authErr.message)
        detalhes.push({ id: emp.id, acao: 'auth_warn', userId: uid })
      } else {
        usuariosRemovidos++
      }
    }

    detalhes.push({ id: emp.id, acao: 'purgada', usuarios: userIds.length, arquivos: arquivosRemovidos })
  }

  // Confirmação pós-purga (registro do que saiu — irreversível).
  if (!dryRun && purgadas > 0) {
    await sendAlertaInterno({
      to: ALERTA_EMAIL,
      assunto: `🗑️ ${purgadas} conta(s) purgada(s) definitivamente`,
      titulo: 'Purga concluída',
      descricao: `${purgadas} conta(s) cancelada(s) há mais de ${RETENCAO_DIAS} dias foram apagadas definitivamente (irreversível). ${usuariosRemovidos} usuário(s) de acesso removido(s), ${arquivosRemovidosTotal} arquivo(s) de Storage removido(s).`,
      linhas: detalhes
        .filter((d) => d.acao === 'purgada')
        .map((d) => `Empresa ${d.id} — ${d.usuarios} usuário(s), ${d.arquivos} arquivo(s)`),
      destaque: 'perigo',
    })
  }

  return NextResponse.json({
    dryRun,
    retencao_dias: RETENCAO_DIAS,
    aviso_dias: AVISO_DIAS,
    corte,
    avisados,
    elegiveis: elegiveis.length,
    purgadas,
    usuarios_removidos: usuariosRemovidos,
    arquivos_removidos: arquivosRemovidosTotal,
    detalhes,
  })
}
