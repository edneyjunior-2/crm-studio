export const maxDuration = 60   // Vercel Pro: até 60s para importações grandes

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizarNumeroCNJ, detectarTribunal } from '@/lib/datajud'

export interface ProcessoImportRow {
  numero_processo:   string
  cliente_nome?:     string
  advogado_nome?:    string
  assunto?:          string
  vara?:             string
  comarca?:          string
  area?:             string
  valor_causa?:      string
  honorarios_tipo?:  string
  honorarios_valor?: string
  providencia?:      string
  status_interno?:   string
  indicacao?:        string
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
  'civel': 'civel', 'civil': 'civel', 'diversas': 'civel', 'diversos': 'civel',
  'trabalhista': 'trabalhista', 'trabalho': 'trabalhista',
  'criminal': 'criminal', 'penal': 'criminal',
  'previdenciario': 'previdenciario', 'previdencia': 'previdenciario',
  'tributario': 'tributario', 'fiscal': 'tributario', 'itiv': 'tributario',
  'administrativo': 'administrativo',
  'familia': 'familia', 'sucessoes': 'familia',
  'precatorio': 'precatorio',
  'fazenda publica': 'fazenda_publica', 'fazenda': 'fazenda_publica', 'faz pub': 'fazenda_publica',
  'outro': 'outro', 'outros': 'outro',
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

  // 1. Normalizar e validar todas as linhas
  type Payload = Record<string, unknown>
  const payloads: Payload[] = []
  const invalidos: { numero: string; motivo: string }[] = []

  for (const row of rows) {
    const numeroRaw = row.numero_processo?.trim()
    if (!numeroRaw) { invalidos.push({ numero: '(vazio)', motivo: 'Número do processo ausente.' }); continue }

    let numero: string
    try { numero = normalizarNumeroCNJ(numeroRaw) }
    catch { invalidos.push({ numero: numeroRaw, motivo: 'Número fora do formato CNJ.' }); continue }

    const tribunalSlug = detectarTribunal(numero)
    const clienteId    = row.cliente_nome  ? clienteMap.get(row.cliente_nome.toLowerCase().trim())  ?? null : null
    const advogadoId   = row.advogado_nome ? advogadoMap.get(row.advogado_nome.toLowerCase().trim()) ?? null : null
    const honTipo      = normalizeHonorariosTipo(row.honorarios_tipo)
    const honTipoValido = honTipo === 'fixo' || honTipo === 'percentual' ? honTipo : null

    const payload: Payload = {
      numero_processo: numero,
      tribunal_slug:   tribunalSlug,
      empresa_id:      empresaId,
      ...(clienteId  && { cliente_id:  clienteId }),
      ...(advogadoId && { advogado_id: advogadoId }),
      ...(row.assunto && { assunto:    row.assunto.trim() }),
      ...(row.vara    && { vara:       row.vara.trim() }),
      ...(row.comarca && { comarca:    row.comarca.trim() }),
      ...(normalizeArea(row.area) !== null         && { area:             normalizeArea(row.area) }),
      ...(parseValor(row.valor_causa) !== null     && { valor_causa:      parseValor(row.valor_causa) }),
      ...(honTipoValido                            && { honorarios_tipo:  honTipoValido }),
      ...(parseValor(row.honorarios_valor) !== null && { honorarios_valor: parseValor(row.honorarios_valor) }),
      ...(row.providencia    && { providencia:    row.providencia.trim() }),
      ...(row.status_interno && { status_interno: row.status_interno.trim() }),
      ...(row.indicacao      && { indicacao:      row.indicacao.trim() }),
    }
    payloads.push(payload)
  }

  result.erros.push(...invalidos)

  // Deduplicar por numero_processo — mantém a última ocorrência de cada CNJ.
  // Sem isso, o PostgreSQL rejeita o lote com "ON CONFLICT DO UPDATE command
  // cannot affect row a second time" quando o mesmo CNJ aparece duas vezes no
  // mesmo INSERT de 50 linhas.
  const deduped = new Map<string, Payload>()
  for (const p of payloads) deduped.set(p.numero_processo as string, p)
  const payloadsUnicos = Array.from(deduped.values())

  // 2. Verificar quais já existem (para contar criados vs atualizados)
  const numeros = payloadsUnicos.map((p) => p.numero_processo as string)
  const { data: existentes } = await admin
    .from('processos_juridicos')
    .select('numero_processo')
    .eq('empresa_id', empresaId)
    .in('numero_processo', numeros)
  const existentesSet = new Set((existentes ?? []).map((e) => e.numero_processo))

  // 3. Batch upsert em lotes de 50
  const LOTE = 50
  for (let i = 0; i < payloadsUnicos.length; i += LOTE) {
    const lote = payloadsUnicos.slice(i, i + LOTE)
    const { error: upsertErr } = await admin
      .from('processos_juridicos')
      .upsert(lote as Parameters<typeof admin.from>[0] extends never ? never : object[], {
        onConflict: 'numero_processo,empresa_id',
        ignoreDuplicates: false,
      })

    if (upsertErr) {
      // Marcar todo o lote como erro
      for (const p of lote) {
        result.erros.push({ numero: p.numero_processo as string, motivo: upsertErr.message })
      }
    } else {
      for (const p of lote) {
        const num = p.numero_processo as string
        existentesSet.has(num) ? result.atualizados++ : result.criados++
      }
    }
  }

  // 4. DataJud: o cron do sistema sincroniza automaticamente.
  //    Processos sem ultimo_datajud_update serão priorizados na próxima rodada.
  result.total = payloadsUnicos.length

  return NextResponse.json(result)
}
