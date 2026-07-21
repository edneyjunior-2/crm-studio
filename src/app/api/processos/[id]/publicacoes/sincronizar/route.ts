import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/auth'
import {
  buscarPublicacoesDJEN,
  montarPublicacoesParaSalvar,
  mensagemErroDjen,
  dataNDiasAtras,
  JANELA_INICIAL_DIAS,
} from '@/lib/djen'
import { sendNovasPublicacoesEmail } from '@/lib/email'

export const maxDuration = 60
// API pública do CNJ bloqueia (403) requests de datacenter fora do Brasil —
// fixa a região da function em São Paulo para não cair nesse bloqueio.
export const preferredRegion = 'gru1'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: processoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { empresaId } = await getAuthUser()
  if (!empresaId) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 403 })

  // Todas as consultas seguintes usam o admin client (bypassa RLS) — o
  // isolamento de tenant precisa ser explícito via .eq('empresa_id', empresaId)
  // em toda query (padrão do projeto para telas/rotas service-role).
  const db = createAdminClient()

  // Garante que o processo pertence à empresa (ativa) do usuário
  const { data: processo, error: errProcesso } = await db
    .from('processos_juridicos')
    .select('id, numero_processo, assunto, advogado_id, empresa_id')
    .eq('id', processoId)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (errProcesso) return NextResponse.json({ error: errProcesso.message }, { status: 500 })
  if (!processo) return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })

  // Reúne todos os responsáveis do processo: principal + adicionais
  // (`processos_advogados`) — uma publicação destinada a QUALQUER um deles
  // precisa ser capturada, não só ao responsável principal.
  const { data: adicionais, error: errAdicionais } = await db
    .from('processos_advogados')
    .select('advogado_id')
    .eq('processo_id', processoId)
  if (errAdicionais) return NextResponse.json({ error: errAdicionais.message }, { status: 500 })

  const idsResponsaveis = [
    ...(processo.advogado_id ? [processo.advogado_id as string] : []),
    ...(adicionais ?? []).map((r) => r.advogado_id as string),
  ]

  if (idsResponsaveis.length === 0) {
    return NextResponse.json({ error: 'Processo sem advogado responsável cadastrado.' }, { status: 400 })
  }

  const { data: profiles, error: errProfiles } = await db
    .from('profiles')
    .select('id, full_name, oab_numero, oab_uf')
    .in('id', idsResponsaveis)
  if (errProfiles) return NextResponse.json({ error: errProfiles.message }, { status: 500 })

  const responsaveisComOab = (profiles ?? []).filter((p) => p.oab_numero && p.oab_uf)
  if (responsaveisComOab.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum responsável deste processo tem OAB cadastrada (Número + UF).' },
      { status: 400 },
    )
  }

  // Casa com QUALQUER processo da empresa (não só este) — uma publicação de
  // um responsável pode pertencer a outro processo dele; ainda assim é salva
  // (processo_id null se não achar match, nunca descartada). Carregado uma
  // vez só e reaproveitado para todos os responsáveis do processo.
  const { data: processosEmpresa } = await db
    .from('processos_juridicos')
    .select('id, numero_processo')
    .eq('empresa_id', empresaId)
  const mapaProcessos = new Map<string, string>(
    (processosEmpresa ?? []).map((p) => [p.numero_processo as string, p.id as string]),
  )

  let novas = 0
  let novasNesteProcesso = 0
  const erros: string[] = []

  type Notificacao = { email: string; nome: string; qtdNovas: number }
  const notificacoes: Notificacao[] = []

  // Sequencial — é 1 processo com poucos responsáveis, não um lote de
  // centenas de advogados (sem necessidade de throttle aqui, ao contrário
  // de `sincronizarPublicacoesDJEN`).
  for (const advogado of responsaveisComOab) {
    try {
      // Janela de busca: desde a última publicação já salva para esse
      // responsável (em qualquer processo dele), ou JANELA_INICIAL_DIAS dias atrás.
      const { data: ultima } = await db
        .from('publicacoes_processo')
        .select('data_disponibilizacao')
        .eq('advogado_id', advogado.id)
        .eq('empresa_id', empresaId)
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
        // Um responsável com a API do DJEN fora do ar não impede a busca
        // dos demais responsáveis do processo.
        erros.push(`OAB ${advogado.oab_numero}/${advogado.oab_uf}: ${mensagemErroDjen(res.motivo)}`)
        continue
      }

      if (res.publicacoes.length === 0) continue

      const linhas = montarPublicacoesParaSalvar({
        publicacoes: res.publicacoes,
        empresaId,
        advogadoId: advogado.id as string,
        resolverProcessoId: (cnj) => mapaProcessos.get(cnj) ?? null,
      })

      // Upsert por djen_id — a mesma publicação buscada via 2 OABs
      // diferentes do mesmo processo nunca gera 2 linhas.
      const { data: inseridas, error: errUpsert } = await db
        .from('publicacoes_processo')
        .upsert(linhas, { onConflict: 'djen_id', ignoreDuplicates: true })
        .select('id, processo_id')

      if (errUpsert) {
        erros.push(`OAB ${advogado.oab_numero}/${advogado.oab_uf}: ${errUpsert.message}`)
        continue
      }

      const qtdInseridas = inseridas?.length ?? 0
      novas += qtdInseridas
      const qtdNesteProcesso = (inseridas ?? []).filter((r) => r.processo_id === processo.id).length
      novasNesteProcesso += qtdNesteProcesso

      // Notifica este responsável só se ELE recebeu publicações novas
      // vinculadas a este processo (o escopo do pedido) — publicação já
      // lida/salva antes não gera e-mail de novo (upsert ignora conflitos).
      if (qtdNesteProcesso > 0) {
        const { data: authRow } = await db.from('profiles_auth').select('email').eq('id', advogado.id).maybeSingle()
        const email = authRow?.email as string | undefined
        if (email) {
          notificacoes.push({
            email,
            nome: (advogado.full_name as string | null) ?? email.split('@')[0],
            qtdNovas: qtdNesteProcesso,
          })
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`OAB ${advogado.oab_numero}/${advogado.oab_uf}: ${msg}`)
    }
  }

  // Só é erro fatal da rota se TODOS os responsáveis falharem. Com pelo menos
  // 1 sucesso, retorna 200 com o resultado parcial acumulado.
  if (erros.length === responsaveisComOab.length) {
    return NextResponse.json({ error: erros.join(' | ') }, { status: 502 })
  }

  for (const n of notificacoes) {
    await sendNovasPublicacoesEmail({
      to: n.email,
      nomeAdvogado: n.nome,
      numeroProcesso: processo.numero_processo,
      assunto: (processo.assunto as string | null) ?? null,
      qtdNovas: n.qtdNovas,
      processoId: processo.id,
    })
  }

  return NextResponse.json({ novas, novas_neste_processo: novasNesteProcesso })
}
