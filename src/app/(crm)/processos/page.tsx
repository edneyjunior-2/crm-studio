import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Scale, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ImportarExcelDialog } from './importar-excel-dialog'
import { ProcessosPageContent } from './processos-page-content'
import { SincronizarDataJudButton } from './sincronizar-datajud-button'
import type { ProcessoStats } from './processos-dashboard'

// ---------------------------------------------------------------------------
// Normaliza qualquer label/slug de área → slug canônico
// ---------------------------------------------------------------------------
const AREA_SLUG_MAP: [RegExp, string][] = [
  [/tribut|itiv|fiscal/i,         'tributario'],
  [/previd/i,                     'previdenciario'],
  [/precat/i,                     'precatorio'],
  [/fazenda|faz\s*pub/i,          'fazenda_publica'],
  [/trabalh/i,                    'trabalhista'],
  [/crimin|penal/i,               'criminal'],
  [/famil/i,                      'familia'],
  [/admin/i,                      'administrativo'],
  [/c[ií]vel|civil|divers/i,      'civel'],
]

export function areaToSlug(area: string): string {
  for (const [re, slug] of AREA_SLUG_MAP) {
    if (re.test(area)) return slug
  }
  return 'outro'
}

export const AREA_LABEL: Record<string, string> = {
  tributario:      'Tributário',
  civel:           'Cível',
  previdenciario:  'Previdenciário',
  precatorio:      'Precatório',
  fazenda_publica: 'Fazenda Pública',
  trabalhista:     'Trabalhista',
  criminal:        'Criminal',
  familia:         'Família',
  administrativo:  'Administrativo',
  outro:           'Outro',
}

// ---------------------------------------------------------------------------
// Label de tribunal a partir do slug DataJud
// ---------------------------------------------------------------------------
export function tribunalLabel(slug: string): string {
  const UP = slug.toUpperCase()
  // Mapeamento dos principais tribunais brasileiros
  const map: Record<string, string> = {
    TJSC: 'TJSC — Santa Catarina',
    TJSP: 'TJSP — São Paulo',
    TJRS: 'TJRS — Rio Grande do Sul',
    TJPR: 'TJPR — Paraná',
    TJRJ: 'TJRJ — Rio de Janeiro',
    TJMG: 'TJMG — Minas Gerais',
    TJBA: 'TJBA — Bahia',
    TJGO: 'TJGO — Goiás',
    TJDF: 'TJDF — Distrito Federal',
    TJPE: 'TJPE — Pernambuco',
    TJCE: 'TJCE — Ceará',
    TJMT: 'TJMT — Mato Grosso',
    TJMS: 'TJMS — Mato Grosso do Sul',
    TJAM: 'TJAM — Amazonas',
    TJPA: 'TJPA — Pará',
    TJMA: 'TJMA — Maranhão',
    TJTO: 'TJTO — Tocantins',
    TJAL: 'TJAL — Alagoas',
    TJSE: 'TJSE — Sergipe',
    TJRN: 'TJRN — Rio Grande do Norte',
    TJPB: 'TJPB — Paraíba',
    TJPI: 'TJPI — Piauí',
    TJAC: 'TJAC — Acre',
    TJAP: 'TJAP — Amapá',
    TJRR: 'TJRR — Roraima',
    TJRO: 'TJRO — Rondônia',
    TRF1: 'TRF1 — 1ª Região',
    TRF2: 'TRF2 — 2ª Região',
    TRF3: 'TRF3 — 3ª Região',
    TRF4: 'TRF4 — 4ª Região',
    TRF5: 'TRF5 — 5ª Região',
    TRF6: 'TRF6 — 6ª Região',
    TST:  'TST — Superior Trabalho',
    STJ:  'STJ — Superior Justiça',
    STF:  'STF — Supremo',
  }
  return map[UP] ?? UP
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function ProcessosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: processos, error },
    { count: totalNaoLidosCount },
    { data: naoLidosPorProcessoRaw },
    { data: advogados },
  ] = await Promise.all([
    supabase
      .from('processos_juridicos')
      .select(`
        id,
        numero_processo,
        tribunal_slug,
        assunto,
        vara,
        area,
        status,
        ultimo_datajud_update,
        created_at,
        advogado_id,
        clientes(id, razao_social),
        profiles!advogado_id(id, full_name)
      `)
      .order('created_at', { ascending: false }),

    // COUNT real — sem trazer linhas (head: true)
    supabase
      .from('movimentacoes_processo')
      .select('*', { count: 'exact', head: true })
      .eq('lido', false),

    // IDs por processo para badges — limite alto para cobrir todos os processos
    supabase
      .from('movimentacoes_processo')
      .select('processo_id')
      .eq('lido', false)
      .limit(50000),

    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
  ])

  // Badge por processo (quantas não lidas cada um tem)
  const naoLidosPorProcesso = new Map<string, number>()
  for (const row of naoLidosPorProcessoRaw ?? []) {
    naoLidosPorProcesso.set(row.processo_id, (naoLidosPorProcesso.get(row.processo_id) ?? 0) + 1)
  }

  const semanaAtras = new Date()
  semanaAtras.setDate(semanaAtras.getDate() - 7)

  const porStatusMap  = new Map<string, number>()
  const porAreaMap    = new Map<string, number>()
  const tribunaisSet  = new Set<string>()
  let semDataJud      = 0

  const processosNorm = (processos ?? []).map((p) => {
    const clienteRaw = p.clientes as unknown
    const advRaw     = (p as Record<string, unknown>)['profiles!advogado_id'] as unknown
    const areaRaw    = (p as Record<string, unknown>).area as string | null
    const areaSlug   = areaRaw ? areaToSlug(areaRaw) : null

    // stats
    porStatusMap.set(p.status, (porStatusMap.get(p.status) ?? 0) + 1)
    if (areaSlug) porAreaMap.set(areaSlug, (porAreaMap.get(areaSlug) ?? 0) + 1)
    if (p.tribunal_slug) tribunaisSet.add(p.tribunal_slug)
    if (!p.ultimo_datajud_update || new Date(p.ultimo_datajud_update) < semanaAtras) semDataJud++

    const isSemDataJud = !p.ultimo_datajud_update || new Date(p.ultimo_datajud_update) < semanaAtras

    return {
      id:             p.id,
      numeroProcesso: p.numero_processo,
      tribunalSlug:   p.tribunal_slug,
      status:         p.status,
      area:           areaSlug,
      areaLabel:      areaSlug ? (AREA_LABEL[areaSlug] ?? areaSlug) : null,
      clienteNome:    (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null,
      advogadoNome:   (advRaw as { full_name?: string } | null)?.full_name ?? null,
      advogadoId:     p.advogado_id as string | null,
      ultimoUpdate:   p.ultimo_datajud_update,
      assunto:        p.assunto,
      vara:           p.vara,
      qtdNaoLidos:    naoLidosPorProcesso.get(p.id) ?? 0,
      semDataJud:     isSemDataJud,
    }
  })

  const stats: ProcessoStats = {
    total:         processosNorm.length,
    porStatus:     Array.from(porStatusMap.entries()).map(([status, count]) => ({ status, count })),
    porArea:       Array.from(porAreaMap.entries()).map(([area, count]) => ({ area, count })),
    totalNaoLidos: totalNaoLidosCount ?? 0,
    semDataJud,
  }

  const tribunais = Array.from(tribunaisSet).sort().map((slug) => ({
    slug,
    label: tribunalLabel(slug),
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
            Processos Jurídicos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe todos os processos e receba atualizações automáticas via DataJud.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SincronizarDataJudButton />
          <ImportarExcelDialog />
          <Link
            href="/processos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
          >
            <Plus className="size-4" />
            Novo processo
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          Erro ao carregar processos. Tente novamente.
        </div>
      )}

      {!error && processosNorm.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <Scale className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum processo cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre o primeiro processo do escritório.</p>
          </div>
          <Link
            href="/processos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <Plus className="size-4" />
            Cadastrar processo
          </Link>
        </div>
      )}

      {!error && processosNorm.length > 0 && (
        <ProcessosPageContent
          stats={stats}
          processos={processosNorm}
          advogados={(advogados ?? []).map((a) => ({ id: a.id, full_name: a.full_name }))}
          tribunais={tribunais}
          areaOpcoes={Array.from(porAreaMap.keys()).sort().map((slug) => ({
            slug,
            label: AREA_LABEL[slug] ?? slug,
          }))}
        />
      )}
    </div>
  )
}
