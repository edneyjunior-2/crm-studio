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

  if (!processo.advogado_id) {
    return NextResponse.json({ error: 'Processo sem advogado responsável cadastrado.' }, { status: 400 })
  }

  const { data: advogado, error: errAdvogado } = await db
    .from('profiles')
    .select('id, full_name, oab_numero, oab_uf')
    .eq('id', processo.advogado_id)
    .maybeSingle()
  if (errAdvogado) return NextResponse.json({ error: errAdvogado.message }, { status: 500 })
  if (!advogado?.oab_numero || !advogado?.oab_uf) {
    return NextResponse.json(
      { error: 'O advogado responsável por este processo não tem OAB cadastrada (Número + UF).' },
      { status: 400 },
    )
  }

  // Janela de busca: desde a última publicação já salva para esse advogado
  // (em qualquer processo dele), ou JANELA_INICIAL_DIAS dias atrás.
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
    numeroOab: advogado.oab_numero,
    ufOab: advogado.oab_uf,
    desde,
  })

  if (!res.ok) {
    return NextResponse.json({ error: mensagemErroDjen(res.motivo) }, { status: 502 })
  }

  if (res.publicacoes.length === 0) {
    return NextResponse.json({ novas: 0, novas_neste_processo: 0 })
  }

  // Casa com QUALQUER processo da empresa (não só este) — uma publicação do
  // mesmo advogado pode pertencer a outro processo dele; ainda assim é salva
  // (processo_id null se não achar match, nunca descartada).
  const { data: processosEmpresa } = await db
    .from('processos_juridicos')
    .select('id, numero_processo')
    .eq('empresa_id', empresaId)
  const mapaProcessos = new Map<string, string>(
    (processosEmpresa ?? []).map((p) => [p.numero_processo as string, p.id as string]),
  )

  const linhas = montarPublicacoesParaSalvar({
    publicacoes: res.publicacoes,
    empresaId,
    advogadoId: advogado.id,
    resolverProcessoId: (cnj) => mapaProcessos.get(cnj) ?? null,
  })

  const { data: inseridas, error: errUpsert } = await db
    .from('publicacoes_processo')
    .upsert(linhas, { onConflict: 'djen_id', ignoreDuplicates: true })
    .select('id, processo_id')
  if (errUpsert) return NextResponse.json({ error: errUpsert.message }, { status: 500 })

  const novas = inseridas?.length ?? 0
  const novasNesteProcesso = (inseridas ?? []).filter((r) => r.processo_id === processo.id).length

  // Notifica o advogado responsável só se este processo (o escopo do pedido)
  // recebeu publicações novas — publicação já lida/salva antes não gera e-mail
  // (não entra em `inseridas`, pois o upsert ignora conflitos por djen_id).
  if (novasNesteProcesso > 0) {
    const { data: authRow } = await db.from('profiles_auth').select('email').eq('id', advogado.id).maybeSingle()
    const email = authRow?.email as string | undefined
    if (email) {
      await sendNovasPublicacoesEmail({
        to: email,
        nomeAdvogado: (advogado.full_name as string | null) ?? email.split('@')[0],
        numeroProcesso: processo.numero_processo,
        assunto: (processo.assunto as string | null) ?? null,
        qtdNovas: novasNesteProcesso,
        processoId: processo.id,
      })
    }
  }

  return NextResponse.json({ novas, novas_neste_processo: novasNesteProcesso })
}
