import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buscarPublicacoesDJEN,
  montarPublicacoesParaSalvar,
  dataNDiasAtras,
  JANELA_INICIAL_DIAS,
} from '@/lib/djen'
import { sendNovasPublicacoesEmail } from '@/lib/email'
import { verificarCronSecret } from '@/lib/cron-auth'

export const maxDuration = 300 // 5 min (Vercel Pro)

// Throttle entre consultas ao DJEN entre advogados — busca sequencial, não
// Promise.all irrestrito (a API não confirmou 429 em teste, mas o backoff em
// buscarPublicacoesDJEN cobre isso; o espaçamento aqui é uma segunda camada
// de precaução para não disparar tudo de uma vez).
const THROTTLE_MS = 700
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Vercel Cron invoca via GET; POST permite trigger manual autenticado
export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

type ProcessoInfo = { id: string; numero_processo: string; assunto: string | null }

async function handler(req: NextRequest) {
  // Proteção por secret (comparação timing-safe — ver src/lib/cron-auth.ts)
  if (!verificarCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  // 1. Empresas com o módulo vertical de Processos (Advocacia) ativo.
  const { data: empresas, error: errEmpresas } = await db
    .from('empresas')
    .select('id, modulos_ativos')
  if (errEmpresas) {
    return NextResponse.json({ error: errEmpresas.message }, { status: 500 })
  }
  const empresaIds = (empresas ?? [])
    .filter((e) => ((e.modulos_ativos as string[] | null) ?? []).includes('processos'))
    .map((e) => e.id as string)

  if (empresaIds.length === 0) {
    return NextResponse.json({ publicacoes_novas: 0, advogados_processados: 0 })
  }

  // 2. Advogados internos com OAB cadastrada nessas empresas.
  const { data: advogados, error: errAdv } = await db
    .from('profiles')
    .select('id, full_name, oab_numero, oab_uf, empresa_id')
    .in('empresa_id', empresaIds)
    .not('oab_numero', 'is', null)

  if (errAdv) {
    return NextResponse.json({ error: errAdv.message }, { status: 500 })
  }

  // 3. Só processa advogados vinculados a pelo menos 1 processo ativo (mesmo
  //    filtro de status usado no cron atualizar-processos: 'em_transito').
  const { data: processosAtivos, error: errProcAtivos } = await db
    .from('processos_juridicos')
    .select('advogado_id')
    .eq('status', 'em_transito')
    .in('empresa_id', empresaIds)
    .not('advogado_id', 'is', null)
  if (errProcAtivos) {
    return NextResponse.json({ error: errProcAtivos.message }, { status: 500 })
  }
  const advogadosComProcessoAtivo = new Set((processosAtivos ?? []).map((p) => p.advogado_id as string))

  const alvos = (advogados ?? []).filter(
    (a) =>
      a.oab_numero &&
      a.oab_uf &&
      advogadosComProcessoAtivo.has(a.id as string),
  )

  if (alvos.length === 0) {
    return NextResponse.json({ publicacoes_novas: 0, advogados_processados: 0 })
  }

  // Cache de processos por empresa (número CNJ normalizado → info do processo),
  // carregado sob demanda e reaproveitado entre advogados da mesma empresa.
  const processosPorEmpresa = new Map<string, Map<string, ProcessoInfo>>()
  async function mapaProcessosDaEmpresa(empresaId: string): Promise<Map<string, ProcessoInfo>> {
    const cache = processosPorEmpresa.get(empresaId)
    if (cache) return cache
    const { data } = await db
      .from('processos_juridicos')
      .select('id, numero_processo, assunto')
      .eq('empresa_id', empresaId)
    const mapa = new Map<string, ProcessoInfo>(
      (data ?? []).map((p) => [
        p.numero_processo as string,
        { id: p.id as string, numero_processo: p.numero_processo as string, assunto: (p.assunto as string | null) ?? null },
      ]),
    )
    processosPorEmpresa.set(empresaId, mapa)
    return mapa
  }

  let publicacoesNovas = 0
  let advogadosProcessados = 0
  const erros: string[] = []

  type Notificacao = { advogadoId: string; processoId: string; numero: string; assunto: string | null; qtdNovas: number }
  const notificacoes: Notificacao[] = []

  for (let i = 0; i < alvos.length; i++) {
    if (i > 0) await sleep(THROTTLE_MS)
    const advogado = alvos[i]
    const empresaId = advogado.empresa_id as string
    const advogadoId = advogado.id as string

    try {
      // Janela de busca: desde a última publicação já salva para esse
      // advogado, ou JANELA_INICIAL_DIAS dias atrás na primeira sincronização.
      const { data: ultima } = await db
        .from('publicacoes_processo')
        .select('data_disponibilizacao')
        .eq('advogado_id', advogadoId)
        .order('data_disponibilizacao', { ascending: false })
        .limit(1)
        .maybeSingle()
      const desde = (ultima?.data_disponibilizacao as string | undefined) ?? dataNDiasAtras(JANELA_INICIAL_DIAS)

      const res = await buscarPublicacoesDJEN({
        numeroOab: advogado.oab_numero as string,
        ufOab: advogado.oab_uf as string,
        desde,
      })

      if (!res.ok) {
        // 429 persistente ou indisponibilidade: registra o erro e segue para
        // o próximo advogado — não derruba o processamento do restante do lote.
        erros.push(`OAB ${advogado.oab_numero}/${advogado.oab_uf}: ${res.motivo}`)
        continue
      }

      advogadosProcessados++

      if (res.publicacoes.length === 0) continue

      const mapaProcessos = await mapaProcessosDaEmpresa(empresaId)
      const linhas = montarPublicacoesParaSalvar({
        publicacoes: res.publicacoes,
        empresaId,
        advogadoId,
        resolverProcessoId: (cnj) => mapaProcessos.get(cnj)?.id ?? null,
      })

      // Upsert por djen_id — nunca duplica, mesmo se a mesma comunicação
      // aparecer para 2 advogados internos destinatários.
      const { data: inseridas, error: errUpsert } = await db
        .from('publicacoes_processo')
        .upsert(linhas, { onConflict: 'djen_id', ignoreDuplicates: true })
        .select('id, processo_id')

      if (errUpsert) {
        erros.push(`OAB ${advogado.oab_numero}/${advogado.oab_uf}: ${errUpsert.message}`)
        continue
      }

      const qtdInseridas = inseridas?.length ?? 0
      publicacoesNovas += qtdInseridas

      // Agrupa as publicações novas COM processo vinculado por processo, para
      // notificar o advogado responsável (mesmo espírito do e-mail de
      // movimentações DataJud).
      const novasPorProcesso = new Map<string, number>()
      for (const row of inseridas ?? []) {
        const processoId = row.processo_id as string | null
        if (!processoId) continue
        novasPorProcesso.set(processoId, (novasPorProcesso.get(processoId) ?? 0) + 1)
      }
      for (const [processoId, qtdNovas] of novasPorProcesso) {
        const info = [...mapaProcessos.values()].find((p) => p.id === processoId)
        notificacoes.push({
          advogadoId,
          processoId,
          numero: info?.numero_processo ?? '',
          assunto: info?.assunto ?? null,
          qtdNovas,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`OAB ${advogado.oab_numero}/${advogado.oab_uf}: ${msg}`)
    }
  }

  // Envia e-mails de alerta para os advogados com novas publicações vinculadas.
  if (notificacoes.length > 0) {
    try {
      const uniqueIds = [...new Set(notificacoes.map((n) => n.advogadoId))]
      const advMap: Record<string, { email: string; nome: string }> = {}

      if (uniqueIds.length > 0) {
        const [{ data: authRows }, { data: perfilRows }] = await Promise.all([
          db.from('profiles_auth').select('id, email').in('id', uniqueIds),
          db.from('profiles').select('id, full_name').in('id', uniqueIds),
        ])
        const nomeMap = new Map(
          (perfilRows ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]),
        )
        for (const r of authRows ?? []) {
          const email = r.email as string | null
          if (email) {
            advMap[r.id as string] = {
              email,
              nome: nomeMap.get(r.id as string) ?? email.split('@')[0],
            }
          }
        }
      }

      await Promise.all(
        notificacoes.map((n) => {
          const adv = advMap[n.advogadoId]
          if (!adv) return Promise.resolve()
          return sendNovasPublicacoesEmail({
            to: adv.email,
            nomeAdvogado: adv.nome,
            numeroProcesso: n.numero,
            assunto: n.assunto,
            qtdNovas: n.qtdNovas,
            processoId: n.processoId,
          })
        }),
      )
    } catch (err) {
      console.error('[cron] falha ao enviar e-mails de publicação DJEN:', err)
    }
  }

  return NextResponse.json({
    publicacoes_novas: publicacoesNovas,
    advogados_processados: advogadosProcessados,
    ...(erros.length ? { erros } : {}),
  })
}
