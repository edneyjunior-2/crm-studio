'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizarNumeroCNJ, detectarTribunal, buscarProcessoDataJud } from '@/lib/datajud'

export interface ProcessoImportRow {
  numero_processo: string
  cliente_nome?: string
  advogado_nome?: string
  assunto?: string
  vara?: string
  comarca?: string
  area?: string
  valor_causa?: string
  honorarios_tipo?: string
  honorarios_valor?: string
}

export interface ImportResult {
  total: number
  criados: number
  atualizados: number
  erros: { numero: string; motivo: string }[]
  semDataJud: { numero: string; motivo: string }[]
}

const HONORARIOS_TIPOS: Record<string, string> = {
  fixo: 'fixo', fixos: 'fixo', 'valor fixo': 'fixo',
  percentual: 'percentual', '%': 'percentual', porcentagem: 'percentual',
  exito: 'exito', 'êxito': 'exito', sucesso: 'exito',
  'por hora': 'hora', hora: 'hora', hourly: 'hora',
}

const AREAS_MAP: Record<string, string> = {
  cível: 'civel', civel: 'civel', civil: 'civel',
  trabalhista: 'trabalhista', trabalho: 'trabalhista',
  criminal: 'criminal', penal: 'criminal',
  previdenciário: 'previdenciario', previdenciario: 'previdenciario', previdência: 'previdenciario',
  tributário: 'tributario', tributario: 'tributario', fiscal: 'tributario',
  administrativo: 'administrativo',
  família: 'familia', familia: 'familia', sucessões: 'familia', sucessao: 'familia',
  outro: 'outro', outros: 'outro',
}

function normalizeArea(raw?: string): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [k, v] of Object.entries(AREAS_MAP)) {
    const kn = k.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (kn === key || key.includes(kn)) return v
  }
  return null
}

function normalizeHonorariosTipo(raw?: string): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [k, v] of Object.entries(HONORARIOS_TIPOS)) {
    const kn = k.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (kn === key || key.includes(kn)) return v
  }
  return null
}

function parseValor(raw?: string): number | null {
  if (!raw) return null
  const cleaned = String(raw).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  const empresaId = profile?.empresa_id
  if (!empresaId) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 403 })

  let rows: ProcessoImportRow[]
  try {
    const body = await req.json()
    rows = body.rows
    if (!Array.isArray(rows) || rows.length === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  // Carregar clientes e advogados da empresa para matching
  const [{ data: clientes }, { data: advogados }] = await Promise.all([
    supabase.from('clientes').select('id, razao_social').eq('empresa_id', empresaId),
    supabase.from('profiles').select('id, full_name').eq('empresa_id', empresaId),
  ])

  const clienteMap = new Map((clientes ?? []).map((c) => [c.razao_social.toLowerCase().trim(), c.id]))
  const advogadoMap = new Map((advogados ?? []).map((a) => [a.full_name.toLowerCase().trim(), a.id]))

  const result: ImportResult = { total: rows.length, criados: 0, atualizados: 0, erros: [], semDataJud: [] }
  const admin = createAdminClient()

  for (const row of rows) {
    const numeroRaw = row.numero_processo?.trim()
    if (!numeroRaw) {
      result.erros.push({ numero: '(vazio)', motivo: 'Número do processo ausente.' })
      continue
    }

    let numero: string
    try {
      numero = normalizarNumeroCNJ(numeroRaw)
    } catch {
      result.erros.push({ numero: numeroRaw, motivo: 'Número fora do formato CNJ.' })
      continue
    }

    const tribunalSlug = detectarTribunal(numero)

    // Match cliente por nome (case-insensitive)
    const clienteId = row.cliente_nome
      ? clienteMap.get(row.cliente_nome.toLowerCase().trim()) ?? null
      : null

    // Match advogado por nome
    const advogadoId = row.advogado_nome
      ? advogadoMap.get(row.advogado_nome.toLowerCase().trim()) ?? null
      : null

    const payload = {
      numero_processo:  numero,
      tribunal_slug:    tribunalSlug,
      empresa_id:       empresaId,
      created_by:       user.id,
      ...(clienteId   && { cliente_id:  clienteId }),
      ...(advogadoId  && { advogado_id: advogadoId }),
      ...(row.assunto && { assunto:     row.assunto.trim() }),
      ...(row.vara    && { vara:        row.vara.trim() }),
      ...(row.comarca && { comarca:     row.comarca.trim() }),
      ...(normalizeArea(row.area)                 && { area:             normalizeArea(row.area) }),
      ...(parseValor(row.valor_causa) !== null    && { valor_causa:      parseValor(row.valor_causa) }),
      ...(normalizeHonorariosTipo(row.honorarios_tipo) && { honorarios_tipo:  normalizeHonorariosTipo(row.honorarios_tipo) }),
      ...(parseValor(row.honorarios_valor) !== null    && { honorarios_valor: parseValor(row.honorarios_valor) }),
    }

    // Upsert por numero_processo + empresa_id
    const { data: upserted, error: upsertErr } = await admin
      .from('processos_juridicos')
      .upsert(payload, { onConflict: 'numero_processo,empresa_id', ignoreDuplicates: false })
      .select('id, created_at, updated_at')
      .single()

    if (upsertErr) {
      result.erros.push({ numero, motivo: upsertErr.message })
      continue
    }

    // Determinar se foi criação ou atualização
    const isNew = upserted.created_at === upserted.updated_at
    isNew ? result.criados++ : result.atualizados++

    // Sincronizar com DataJud (síncrono para reportar erros ao usuário)
    try {
      const djRes = await buscarProcessoDataJud(numero, tribunalSlug)
      if (!djRes.ok) {
        result.semDataJud.push({
          numero,
          motivo: djRes.motivo === 'nao_encontrado'
            ? 'Processo não encontrado no DataJud — salvo apenas com os dados da planilha.'
            : 'DataJud indisponível no momento — processo salvo, atualização pendente.',
        })
      } else {
        const dados = djRes.processo
        await admin.from('processos_juridicos').update({
          assunto:               dados.assunto ?? undefined,
          area:                  dados.area ?? undefined,
          vara:                  dados.vara ?? undefined,
          comarca:               dados.comarca ?? undefined,
          valor_causa:           dados.valor ?? undefined,
          ultimo_datajud_update: new Date().toISOString(),
        }).eq('id', upserted.id)

        if (dados.movimentos?.length) {
          const movs = dados.movimentos.map((m) => ({
            processo_id:       upserted.id,
            empresa_id:        empresaId,
            codigo_movimento:  m.codigo,
            nome_movimento:    m.nome,
            data_movimentacao: m.dataHora,
            complemento:       m.complemento ?? null,
            lido:              false,
          }))
          await admin.from('movimentacoes_processo')
            .upsert(movs, { onConflict: 'processo_id,codigo_movimento,data_movimentacao', ignoreDuplicates: true })
        }
      }
    } catch {
      result.semDataJud.push({ numero, motivo: 'Erro de comunicação com o DataJud.' })
    }
  }

  return NextResponse.json(result)
}
