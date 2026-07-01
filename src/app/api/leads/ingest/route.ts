import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { verificarApiKey } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Ingestão de lead qualificado vindo de uma integração externa (ex.: SDR Leila).
 *
 * Autenticação: Authorization: Bearer <api_key>. A empresa é resolvida pela
 * chave (api_keys.empresa_id) — NUNCA pelo corpo. Cria/atualiza o cliente e
 * abre um negócio no pipeline (estágio 'qualificacao') + registra a nota do
 * resumo da triagem. Multi-tenant: todo insert leva empresa_id explícito
 * (service_role não tem tenant no contexto).
 *
 * O SDR é um ADD-ON vendido à parte: ter uma API key gerada (no admin) já
 * implica que a empresa contratou a integração. Hardening pendente p/ volume
 * alto: rate-limit por chave (H1) e idempotência forte via UNIQUE + upsert
 * (M1/M2). Hoje o volume é baixo e sequencial; risco de corrida desprezível.
 */

const leadSchema = z.object({
  nome:        z.string().trim().min(1, 'nome é obrigatório').max(200),
  // valida pelos DÍGITOS (após remover formatação) — evita "------" passar no min
  telefone:    z.string().trim().transform((v) => v.replace(/\D/g, ''))
                 .pipe(z.string().min(10, 'telefone inválido').max(15)),
  segmento:    z.string().trim().max(120).optional(),
  faturamento: z.string().trim().max(120).optional(),
  regime:      z.string().trim().max(120).optional(),
  passivo:     z.string().trim().max(500).optional(),
  urgencia:    z.string().trim().max(120).optional(),
  objetivo:    z.string().trim().max(500).optional(),
  resumo:      z.string().trim().max(4000).optional(),
})

export async function POST(req: NextRequest) {
  // 1) Autenticação por API key → empresa
  const auth = await verificarApiKey(req.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ error: 'API key inválida ou ausente.' }, { status: 401 })
  }
  const empresaId = auth.empresaId

  // 1b) Verifica se a empresa está ativa — chaves de empresas canceladas/suspensas não ingerem leads
  const { data: empresaStatus } = await createAdminClient()
    .from('empresas')
    .select('status')
    .eq('id', empresaId)
    .maybeSingle()
  if (empresaStatus?.status === 'cancelado' || empresaStatus?.status === 'suspenso') {
    return NextResponse.json(
      { error: 'Conta suspensa ou cancelada. Entre em contato com o suporte.' },
      { status: 403 },
    )
  }

  // 1c) Rate-limit por empresa: 60 leads/min (generoso p/ bot; barra runaway/loop)
  if (!(await rateLimit(`leads-ingest:${empresaId}`, 60, 60))) {
    return NextResponse.json({ error: 'Limite de ingestão excedido. Tente novamente em instantes.' }, { status: 429 })
  }

  // 2) Validação do corpo
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 })
  }
  const parsed = leadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados do lead inválidos.', detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const lead = parsed.data
  const telefone = lead.telefone // já normalizado p/ dígitos pelo schema

  const db = createAdminClient()

  // 2b) Etapas abertas do tenant (pipeline_estagios) — usado no dedup e no insert
  const { data: estagiosDoTenant } = await db
    .from('pipeline_estagios')
    .select('slug, ordem, tipo')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  const estagiosAbertos: string[] =
    estagiosDoTenant
      ?.filter((e) => e.tipo === 'aberto')
      .map((e) => e.slug as string) ?? []

  // 1ª etapa aberta ativa (menor ordem) — onde o novo lead entra no kanban
  const estagioInicial: string =
    estagiosAbertos[0] ?? 'prospeccao'

  // 3) Responsável padrão: um admin da empresa (fallback: qualquer perfil)
  const { data: perfis } = await db
    .from('profiles')
    .select('id, role')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: true })
  const responsavel = perfis?.find((p) => p.role === 'admin') ?? perfis?.[0]
  if (!responsavel) {
    return NextResponse.json({ error: 'Empresa sem usuários para atribuir o lead.' }, { status: 422 })
  }
  const responsavelId = responsavel.id

  // 4) Solução padrão da empresa para leads do SDR (find-or-create)
  let solucaoId: string
  const { data: solExistente } = await db
    .from('solucoes')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('nome', 'Lead SDR')
    .maybeSingle()
  if (solExistente?.id) {
    solucaoId = solExistente.id
  } else {
    const { data: solNova, error: errSol } = await db
      .from('solucoes')
      .insert({
        empresa_id: empresaId,
        nome: 'Lead SDR',
        descricao: 'Leads recebidos automaticamente via SDR (atendimento por IA).',
        ativo: true,
        created_by: responsavelId,
      })
      .select('id')
      .single()
    if (errSol || !solNova) {
      console.error('[ingest] falha ao criar solução padrão:', errSol?.message, { empresaId })
      return NextResponse.json({ error: 'Erro interno ao processar o lead.' }, { status: 500 })
    }
    solucaoId = solNova.id
  }

  // 5) Cliente: dedup por (empresa_id + telefone); cria se não existir
  let clienteId: string
  let clienteNovo = false
  const { data: clienteExistente } = await db
    .from('clientes')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('contato_telefone', telefone)
    .limit(1)
    .maybeSingle()

  if (clienteExistente?.id) {
    clienteId = clienteExistente.id
  } else {
    const { data: clienteCriado, error: errCli } = await db
      .from('clientes')
      .insert({
        empresa_id:        empresaId,
        razao_social:      lead.nome,
        contato_nome:      lead.nome,
        contato_telefone:  telefone,
        segmento:          lead.segmento ?? null,
        tipo_pessoa:       'pf',
        bloqueio_exclusividade: false,
        area_tipo:         'publica',
        observacoes:       'Lead recebido via SDR (WhatsApp).',
        responsavel_id:    responsavelId,
        responsavel_desde: new Date().toISOString(),
        created_by:        responsavelId,
      })
      .select('id')
      .single()
    if (errCli || !clienteCriado) {
      console.error('[ingest] falha ao criar cliente:', errCli?.message, { empresaId })
      return NextResponse.json({ error: 'Erro interno ao processar o lead.' }, { status: 500 })
    }
    clienteId = clienteCriado.id
    clienteNovo = true
  }

  // 6) Negócio: reusa um negócio EM ABERTO do cliente (evita cards duplicados em reenvios)
  let negocioId: string | null = null
  if (!clienteNovo) {
    const { data: aberto } = await db
      .from('negocios')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('cliente_id', clienteId)
      .in('estagio', estagiosAbertos.length > 0 ? estagiosAbertos : ['prospeccao'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    negocioId = aberto?.id ?? null
  }

  let negocioCriado = false
  if (!negocioId) {
    const probabilidade = lead.urgencia ? 80 : 50
    const titulo = `Diagnóstico — ${lead.segmento || lead.objetivo || lead.nome}`.slice(0, 200)
    const { data: negocio, error: errNeg } = await db
      .from('negocios')
      .insert({
        empresa_id:     empresaId,
        cliente_id:     clienteId,
        solucao_id:     solucaoId,
        responsavel_id: responsavelId,
        titulo,
        estagio:        estagioInicial,
        probabilidade,
      })
      .select('id')
      .single()
    if (errNeg || !negocio) {
      console.error('[ingest] falha ao criar negócio:', errNeg?.message, { empresaId })
      return NextResponse.json({ error: 'Erro interno ao processar o lead.' }, { status: 500 })
    }
    negocioId = negocio.id
    negocioCriado = true
  }

  // 7) Atividade (nota) com o resumo da triagem
  const partesResumo = [
    lead.resumo,
    lead.faturamento && `Faturamento: ${lead.faturamento}`,
    lead.regime && `Regime: ${lead.regime}`,
    lead.passivo && `Passivo: ${lead.passivo}`,
    lead.urgencia && `Urgência: ${lead.urgencia}`,
    lead.objetivo && `Objetivo: ${lead.objetivo}`,
  ].filter(Boolean)
  const descricao = (partesResumo.join('\n') || 'Lead qualificado via SDR.').slice(0, 4000)
  const hoje = new Date()
  const dataAtividade = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const { error: errAtiv } = await db.from('atividades').insert({
    empresa_id:     empresaId,
    negocio_id:     negocioId,
    cliente_id:     clienteId,
    responsavel_id: responsavelId,
    tipo:           'nota',
    descricao,
    data_atividade: dataAtividade,
  })
  // A nota é secundária — não falha a ingestão se ela não gravar, mas registra.
  if (errAtiv) {
    console.error('[ingest] falha ao registrar nota da triagem:', errAtiv.message, { negocioId, empresaId })
  }

  return NextResponse.json(
    {
      ok: true,
      cliente_id:    clienteId,
      negocio_id:    negocioId,
      cliente_novo:  clienteNovo,
      negocio_novo:  negocioCriado,
    },
    { status: 201 },
  )
}
