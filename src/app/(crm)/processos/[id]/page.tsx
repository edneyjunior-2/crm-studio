import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Scale, Building2, User, MapPin, BookOpen, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AudienciaButton } from './audiencia-button'
import { MarcarLidoOnMount } from './marcar-lido-on-mount'
import { ProcessoAcoes } from './processo-acoes'

interface PageProps {
  params: Promise<{ id: string }>
}

const AREA_LABEL: Record<string, string> = {
  civel:          'Cível',
  trabalhista:    'Trabalhista',
  criminal:       'Criminal',
  previdenciario: 'Previdenciário',
  tributario:     'Tributário',
  administrativo: 'Administrativo',
  familia:        'Família e Sucessões',
  outro:          'Outro',
}

// data_movimentacao é um `date` ('YYYY-MM-DD'): parse direto dos componentes,
// sem `new Date()` (que interpretaria como UTC e poderia recuar um dia em BRT).
function formatarData(data: string | null): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return data
  return `${dia}/${mes}/${ano}`
}

// timestamptz (ISO com fuso): formata no fuso de Brasília.
function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)).replace(',', ' às')
}

function isAudiencia(descricao: string): boolean {
  const lower = descricao.toLowerCase()
  // Apenas "audiência" — evita falso-positivo com "julgamento"/"sessão"/"instrução".
  return lower.includes('audiência') || lower.includes('audiencia')
}

export default async function ProcessoDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: processo, error } = await supabase
    .from('processos_juridicos')
    .select(`
      *,
      clientes(id, razao_social),
      profiles!advogado_id(id, full_name)
    `)
    .eq('id', id)
    .single()

  if (error || !processo) notFound()

  const { data: movimentacoes, error: errMov } = await supabase
    .from('movimentacoes_processo')
    .select('*')
    .eq('processo_id', id)
    .order('data_movimentacao', { ascending: false })

  if (errMov) {
    console.error('[processos] erro ao carregar movimentações:', errMov.message)
  }

  // Papel do usuário (só admin exclui processo)
  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const podeExcluir = perfil?.role === 'admin'

  const clienteRaw = processo.clientes as unknown
  const advRaw     = (processo as Record<string, unknown>)['profiles!advogado_id'] as unknown
  const clienteNome = (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null
  const advNome     = (advRaw as { full_name?: string } | null)?.full_name ?? null

  const partes = (processo.partes_raw as { polo: string; nome: string }[] | null) ?? []

  // Audiências (futuras e passadas)
  const audiencias = (movimentacoes ?? []).filter((m) => isAudiencia(m.descricao))

  // Valores do resumo (KPIs)
  const movCount = movimentacoes?.length ?? 0
  const areaLabel = processo.area ? (AREA_LABEL[processo.area] ?? processo.area) : '—'
  const valorCausaFmt = processo.valor_causa
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valor_causa)
    : '—'
  const ultimaAtt = processo.ultimo_datajud_update
    ? formatarDataHora(processo.ultimo_datajud_update)
    : '—'

  // Agrupa movimentações por mês (já vêm ordenadas desc por data)
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  type Mov = { id: string; descricao: string; complemento: string | null; data_movimentacao: string }
  const gruposMov: { mes: string; itens: Mov[] }[] = []
  for (const m of (movimentacoes ?? []) as Mov[]) {
    const [ano, mes] = m.data_movimentacao.slice(0, 10).split('-')
    const rotulo = `${MESES[Number(mes) - 1] ?? mes} de ${ano}`
    const ultimo = gruposMov[gruposMov.length - 1]
    if (ultimo && ultimo.mes === rotulo) ultimo.itens.push(m)
    else gruposMov.push({ mes: rotulo, itens: [m] })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Marca as movimentações como lidas no client, após o render */}
      <MarcarLidoOnMount processoId={id} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/processos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Processos
        </Link>
      </div>

      {/* Cabeçalho do processo */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Scale className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-foreground">
                {processo.numero_processo}
              </p>
              <p className="text-sm text-muted-foreground">
                Tribunal: {(processo.tribunal_slug ?? '—').toUpperCase()}
              </p>
            </div>
          </div>
          <ProcessoAcoes
            processoId={id}
            statusAtual={processo.status}
            podeExcluir={podeExcluir}
          />
        </div>

        {/* Faixa de resumo (KPIs) */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Área" value={areaLabel} />
          <Kpi label="Valor da causa" value={valorCausaFmt} />
          <Kpi label="Movimentações" value={String(movCount)} />
          <Kpi label="Atualizado (DataJud)" value={ultimaAtt} />
        </div>

        {/* Grid de informações */}
        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {processo.assunto && (
            <InfoItem icon={BookOpen} label="Assunto" value={processo.assunto} />
          )}
          {processo.vara && (
            <InfoItem icon={MapPin} label="Vara" value={processo.vara} />
          )}
          {processo.comarca && (
            <InfoItem icon={MapPin} label="Comarca" value={processo.comarca} />
          )}
          {clienteNome && (
            <InfoItem icon={Building2} label="Cliente" value={clienteNome} />
          )}
          {advNome && (
            <InfoItem icon={User} label="Advogado responsável" value={advNome} />
          )}
        </div>

        {/* Partes */}
        {partes.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Partes
            </p>
            <div className="flex flex-wrap gap-2">
              {partes.map((p, i) => (
                <span
                  key={i}
                  className="rounded-lg border border-border bg-muted/50 px-3 py-1 text-xs"
                >
                  <span className="font-medium capitalize">{p.polo}:</span> {p.nome}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Próximas Audiências */}
      {audiencias.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-foreground">Audiências</h3>
          <div className="flex flex-col gap-2">
            {audiencias.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{a.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatarData(a.data_movimentacao)}
                    {a.complemento && ` · ${a.complemento}`}
                  </p>
                </div>
                <AudienciaButton
                  descricao={a.descricao}
                  dataSugerida={a.data_movimentacao}
                  processoNumero={processo.numero_processo}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline de movimentações */}
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-foreground">
          Movimentações
          {movimentacoes && movimentacoes.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({movimentacoes.length} registros)
            </span>
          )}
        </h3>

        {(!movimentacoes || movimentacoes.length === 0) ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            <AlertCircle className="size-4" />
            Nenhuma movimentação registrada. O cron das 8h buscará as atualizações do DataJud.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {gruposMov.map((grupo, gi) => (
              <div key={grupo.mes} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {grupo.mes}
                </p>
                <div className="relative flex flex-col">
                  <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" aria-hidden />
                  {grupo.itens.map((m, mi) => {
                    const audiencia = isAudiencia(m.descricao)
                    const recente = gi === 0 && mi === 0
                    return (
                      <div key={m.id} className="relative flex gap-4 pb-5 last:pb-0">
                        <div
                          className={`relative z-10 mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                            recente
                              ? 'border-primary bg-primary/15'
                              : audiencia
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950'
                                : 'border-border bg-card'
                          }`}
                          aria-hidden
                        />
                        <div className="flex flex-1 flex-col gap-0.5 pb-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium leading-snug ${
                              audiencia ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                            }`}>
                              {m.descricao}
                              {recente && (
                                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  Mais recente
                                </span>
                              )}
                              {audiencia && (
                                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                  Audiência
                                </span>
                              )}
                            </p>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatarData(m.data_movimentacao)}
                            </span>
                          </div>
                          {m.complemento && (
                            <p className="text-xs text-muted-foreground">{m.complemento}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </span>
    </div>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}
