import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Scale, Building2, User, MapPin, BookOpen, AlertCircle, Pencil, ArrowUpRight,
  ClipboardList, Tag, Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularHonorarios, formatarBRL } from '@/lib/honorarios'
import { AgendarAudienciaDialog } from './agendar-audiencia-dialog'
import { MarcarLidoOnMount } from './marcar-lido-on-mount'
import { ProcessoAcoes } from './processo-acoes'
import { MovimentacoesTimeline } from './movimentacoes-timeline'
import { IndicacaoParceiroPrompt } from './indicacao-parceiro-prompt'
import { ProcessoDetalheTabs } from './processo-detalhe-tabs'
import type { DocItem } from './doc-actions'


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

  // Busca paralela: movimentações, histórico interno, prazos, documentos, perfil, auth users
  const admin = createAdminClient()
  const [
    { data: movimentacoes, error: errMov },
    { data: movInternas },
    { data: prazosRaw },
    { data: documentosRaw },
    { data: perfil },
    { data: authUsers },
    { data: empresaProfiles },
  ] = await Promise.all([
    supabase.from('movimentacoes_processo').select('*').eq('processo_id', id).order('data_movimentacao', { ascending: false }),
    supabase.from('movimentacoes_internas_processo').select('id, assunto, descricao, created_at, profiles!autor_id(full_name)').eq('processo_id', id).order('created_at', { ascending: false }),
    supabase.from('processos_prazos').select('id, descricao, data_prazo, cumprido, responsavel_id, profiles!responsavel_id(full_name)').eq('processo_id', id).order('data_prazo', { ascending: true }),
    supabase.from('processos_documentos').select('id, nome, storage_path, mime_type, tamanho, created_at, profiles!autor_id(full_name)').eq('processo_id', id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    admin.auth.admin.listUsers(),
    supabase.from('profiles').select('id, full_name'),
  ])

  if (errMov) {
    console.error('[processos] erro ao carregar movimentações:', errMov.message)
  }
  const podeExcluir = perfil?.role === 'admin'

  // Filtra authUsers para conter apenas membros desta empresa (via RLS nos profiles)
  const empresaUserIds = new Set((empresaProfiles ?? []).map((p) => p.id))
  const profileMap = Object.fromEntries((empresaProfiles ?? []).map((p) => [p.id, p.full_name as string]))
  const membros = (authUsers?.users ?? [])
    .filter((u) => u.email && empresaUserIds.has(u.id))
    .map((u) => ({ id: u.id, nome: profileMap[u.id] ?? u.email!.split('@')[0], email: u.email! }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const clienteRaw = processo.clientes as unknown
  const advRaw     = (processo as Record<string, unknown>)['profiles!advogado_id'] as unknown
  const clienteNome = (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null
  const clienteId   = (clienteRaw as { id?: string } | null)?.id ?? null
  const advNome     = (advRaw as { full_name?: string } | null)?.full_name ?? null

  const partes = (processo.partes_raw as { polo: string; nome: string }[] | null) ?? []

  // Email do advogado responsável (para pré-selecionar no agendamento)
  const advogadoId  = (processo as Record<string, unknown>).advogado_id as string | null
  const advogadoEmail = advogadoId
    ? (authUsers?.users ?? []).find((u) => u.id === advogadoId)?.email ?? null
    : null

  // Indicação → Parceiro
  const indicacao = (processo as Record<string, unknown>).indicacao as string | null
  let parceiroVinculado: { id: string; nome: string } | null = null
  if (indicacao) {
    const { data: pcRaw } = await supabase
      .from('parceiros')
      .select('id, nome')
      .ilike('nome', indicacao.trim())
      .limit(1)
      .maybeSingle()
    parceiroVinculado = pcRaw ?? null
  }

  // Audiências (futuras e passadas)
  const audiencias = (movimentacoes ?? []).filter((m) => isAudiencia(m.descricao))

  // Valores do resumo (KPIs)
  const movCount = movimentacoes?.length ?? 0
  const areaLabel = processo.area ? (AREA_LABEL[processo.area] ?? processo.area) : '—'
  const valorCausaFmt = processo.valor_causa
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valor_causa)
    : '—'

  // Honorário do advogado (o que de fato é dele; baseia a previsão de ganho)
  const honorario = calcularHonorarios(processo.honorarios_tipo, processo.honorarios_valor, processo.valor_causa)
  const honorarioFmt = honorario != null ? formatarBRL(honorario) : '—'
  const honorarioSub =
    processo.honorarios_tipo === 'percentual' && processo.honorarios_valor != null
      ? `${processo.honorarios_valor}% da causa`
      : processo.honorarios_tipo === 'fixo'
        ? 'valor fixo'
        : ''
  const ultimaAtt = processo.ultimo_datajud_update
    ? formatarDataHora(processo.ultimo_datajud_update)
    : '—'

  // Agrupa movimentações por mês (já vêm ordenadas desc por data)
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  type Mov = { id: string; descricao: string; complemento: string | null; data_movimentacao: string; codigo_movimento: number | null }
  const gruposMov: { mes: string; itens: Mov[] }[] = []
  for (const m of (movimentacoes ?? []) as Mov[]) {
    const [ano, mes] = m.data_movimentacao.slice(0, 10).split('-')
    const rotulo = `${MESES[Number(mes) - 1] ?? mes} de ${ano}`
    const ultimo = gruposMov[gruposMov.length - 1]
    if (ultimo && ultimo.mes === rotulo) ultimo.itens.push(m)
    else gruposMov.push({ mes: rotulo, itens: [m] })
  }

  // Dados prontos para o acordeão (formata data + flag de audiência aqui no server)
  const recenteId = gruposMov[0]?.itens[0]?.id ?? null
  const gruposTimeline = gruposMov.map((g) => ({
    mes: g.mes,
    itens: g.itens.map((m) => ({
      id: m.id,
      descricao: m.descricao,
      complemento: m.complemento,
      data: formatarData(m.data_movimentacao),
      audiencia: isAudiencia(m.descricao),
      isManual: m.codigo_movimento == null,
    })),
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Marca as movimentações como lidas no client, após o render */}
      <MarcarLidoOnMount processoId={id} />

      {/* Breadcrumb + editar */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/processos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Processos
        </Link>
        <Link
          href={`/processos/${id}/editar`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Pencil className="size-3.5" />
          Editar
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
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label="Honorário" value={honorarioFmt} sub={honorarioSub} accent />
          <Kpi label="Valor da causa" value={valorCausaFmt} />
          <Kpi label="Área" value={areaLabel} />
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
          {clienteNome && clienteId ? (
            <Link
              href={`/clientes/${clienteId}`}
              className="group -m-1 flex items-start gap-2 rounded-lg p-1 transition-colors hover:bg-accent"
            >
              <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  Cliente
                  <ArrowUpRight className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
                </p>
                <p className="truncate text-sm text-foreground group-hover:text-primary">{clienteNome}</p>
                <p className="text-[11px] text-muted-foreground">Ver cadastro (telefone, e-mail)</p>
              </div>
            </Link>
          ) : clienteNome ? (
            <InfoItem icon={Building2} label="Cliente" value={clienteNome} />
          ) : null}
          {advNome && (
            <InfoItem icon={User} label="Advogado responsável" value={advNome} />
          )}
          {!!(processo as Record<string, unknown>).indicacao && (
            <InfoItem icon={Users} label="Indicação" value={String((processo as Record<string, unknown>).indicacao)} />
          )}
          {!!(processo as Record<string, unknown>).polo_passivo_nome && (
            <InfoItem icon={Users} label="Polo passivo" value={String((processo as Record<string, unknown>).polo_passivo_nome)} />
          )}
          {!!(processo as Record<string, unknown>).advogado_adversario_nome && (
            <InfoItem
              icon={User}
              label="Adv. adversário"
              value={`${String((processo as Record<string, unknown>).advogado_adversario_nome)}${(processo as Record<string, unknown>).advogado_adversario_oab ? ` (OAB: ${String((processo as Record<string, unknown>).advogado_adversario_oab)})` : ''}`}
            />
          )}
        </div>

        {/* Dados do escritório (importados da planilha) */}
        {(!!(processo as Record<string, unknown>).providencia || !!(processo as Record<string, unknown>).status_interno) && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acompanhamento interno
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {!!(processo as Record<string, unknown>).status_interno && (
                <div className="flex items-start gap-2">
                  <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Status interno</p>
                    <p className="text-sm text-foreground">{String((processo as Record<string, unknown>).status_interno)}</p>
                  </div>
                </div>
              )}
              {!!(processo as Record<string, unknown>).providencia && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Providência</p>
                    <p className="text-sm text-foreground leading-relaxed">{String((processo as Record<string, unknown>).providencia)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Indicação → Parceiro */}
        {indicacao && (
          <IndicacaoParceiroPrompt
            indicacao={indicacao}
            clienteId={clienteId}
            parceiroId={parceiroVinculado?.id ?? null}
            parceiroNome={parceiroVinculado?.nome ?? null}
          />
        )}

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
                <AgendarAudienciaDialog
                  descricao={a.descricao}
                  dataSugerida={a.data_movimentacao}
                  processoNumero={processo.numero_processo}
                  vara={processo.vara ?? null}
                  comarca={processo.comarca ?? null}
                  clienteNome={clienteNome}
                  areaLabel={areaLabel !== '—' ? areaLabel : null}
                  advogadoEmail={advogadoEmail}
                  membros={membros}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abas: Movimentações | Histórico Interno | Prazos | Documentos */}
      <ProcessoDetalheTabs
        processoId={id}
        gruposTimeline={gruposTimeline}
        recenteId={recenteId}
        totalMov={movimentacoes?.length ?? 0}
        movInternas={(movInternas ?? []).map((m) => {
          const autorRaw = (m as Record<string, unknown>)['profiles!autor_id'] as { full_name?: string } | null
          return {
            id:         m.id,
            assunto:    m.assunto as string,
            descricao:  m.descricao as string | null,
            created_at: m.created_at as string,
            autor_nome: autorRaw?.full_name ?? null,
          }
        })}
        prazos={(prazosRaw ?? []).map((p) => ({
          id:               p.id,
          descricao:        p.descricao as string,
          data_prazo:       p.data_prazo as string,
          cumprido:         p.cumprido as boolean,
          responsavel_id:   p.responsavel_id as string | null,
          responsavel_nome: ((p as Record<string, unknown>)['profiles!responsavel_id'] as { full_name?: string } | null)?.full_name ?? null,
        }))}
        documentos={(documentosRaw ?? []).map((d) => {
          const autorRaw = (d as Record<string, unknown>)['profiles!autor_id'] as { full_name?: string } | null
          return {
            id:           d.id,
            nome:         d.nome as string,
            storage_path: d.storage_path as string,
            mime_type:    d.mime_type as string | null,
            tamanho:      d.tamanho as number | null,
            created_at:   d.created_at as string,
            autor_nome:   autorRaw?.full_name ?? null,
          } satisfies DocItem
        })}
        membros={membros}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 ${
        accent
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
          : 'border-border bg-muted/30'
      }`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={`truncate text-sm font-semibold ${accent ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}
        title={value}
      >
        {value}
      </span>
      {sub && <span className="truncate text-[10px] text-muted-foreground">{sub}</span>}
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
