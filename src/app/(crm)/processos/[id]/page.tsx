import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Scale, Building2, User, MapPin, BookOpen, AlertCircle, Pencil, ArrowUpRight,
  ClipboardList, Tag, Users, Handshake,
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
import { SolicitarGuiaDialog } from './solicitar-guia-dialog'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
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

// Status legível para a badge read-only do portal do parceiro (sem ProcessoAcoes).
const STATUS_LABEL: Record<string, string> = {
  ativo:     'Ativo',
  encerrado: 'Encerrado',
  suspenso:  'Suspenso',
  arquivado: 'Arquivado',
  concluido: 'Concluído',
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
      profiles!advogado_id(id, full_name),
      parceiro:profiles!parceiro_id(id, full_name)
    `)
    .eq('id', id)
    .single()

  if (error || !processo) notFound()

  // Busca paralela: movimentações (fetchAllRows — evita cap 1000), histórico interno, prazos, documentos, perfil, auth users
  const admin = createAdminClient()

  // advogado_id já é conhecido aqui (processo já foi buscado acima) — inclui no
  // lote de e-mails abaixo, mesmo que por algum motivo não esteja em empresaProfiles.
  const advogadoIdProcesso = (processo as Record<string, unknown>).advogado_id as string | null

  // fetchAllRows lança em erro de banco — capturamos para não derrubar o RSC
  let movimentacoes: Record<string, unknown>[] | null = null
  let errMov: { message: string } | null = null
  try {
    movimentacoes = await fetchAllRows((from, to) =>
      supabase
        .from('movimentacoes_processo')
        .select('*')
        .eq('processo_id', id)
        .order('data_movimentacao', { ascending: false })
        .range(from, to),
    )
  } catch (e) {
    errMov = e as { message: string }
  }

  const [
    { data: movInternas },
    { data: prazosRaw },
    { data: documentosRaw },
    { data: perfil },
    { data: empresaProfiles },
  ] = await Promise.all([
    supabase.from('movimentacoes_internas_processo').select('id, assunto, descricao, created_at, profiles!autor_id(full_name)').eq('processo_id', id).order('created_at', { ascending: false }),
    supabase.from('processos_prazos').select('id, descricao, data_prazo, cumprido, responsavel_id, profiles!responsavel_id(full_name)').eq('processo_id', id).order('data_prazo', { ascending: true }),
    supabase.from('processos_documentos').select('id, nome, storage_path, mime_type, tamanho, created_at, profiles!autor_id(full_name)').eq('processo_id', id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profiles').select('id, full_name'),
  ])

  if (errMov) {
    console.error('[processos] erro ao carregar movimentações:', errMov.message)
  }
  const podeExcluir = perfil?.role === 'admin'
  // Parceiro (externo) enxerga só o básico deste processo — sem abas de
  // documentos/prazos/honorários/partes/andamentos internos, sem ações de
  // escrita. A RLS já nega os dados nas tabelas-filhas; isto é só a UI.
  const isParceiro   = perfil?.role === 'parceiro'

  // E-mails via view profiles_auth (service-role) — NÃO admin.auth.admin.listUsers()
  // (GoTrue), que falha/retorna vazio em produção neste projeto.
  const idsParaEmail = new Set((empresaProfiles ?? []).map((p) => p.id))
  if (advogadoIdProcesso) idsParaEmail.add(advogadoIdProcesso)
  const { data: authRows } = idsParaEmail.size
    ? await admin.from('profiles_auth').select('id, email').in('id', [...idsParaEmail])
    : { data: [] as { id: string; email: string | null }[] }
  const emailMap = new Map((authRows ?? []).map((r) => [r.id as string, r.email as string | null]))

  // Filtra para conter apenas membros desta empresa (via RLS nos profiles)
  const profileMap = Object.fromEntries((empresaProfiles ?? []).map((p) => [p.id, p.full_name as string]))
  const membros = (empresaProfiles ?? [])
    .filter((p) => emailMap.get(p.id))
    .map((p) => ({ id: p.id, nome: profileMap[p.id] ?? emailMap.get(p.id)!.split('@')[0], email: emailMap.get(p.id)! }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const clienteRaw  = processo.clientes as unknown
  const advRaw      = (processo as Record<string, unknown>)['profiles!advogado_id'] as unknown
  // "Parceiro" aqui = usuário portal (profiles.role='parceiro'), NÃO confundir
  // com public.parceiros (indicador comercial sem login, usado no bloco
  // "Indicação → Parceiro" abaixo — são dois conceitos distintos no produto).
  const parceiroPortalRaw  = (processo as Record<string, unknown>).parceiro as unknown
  const clienteNome = (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null
  const clienteId   = (clienteRaw as { id?: string } | null)?.id ?? null
  const advNome     = (advRaw as { full_name?: string } | null)?.full_name ?? null
  const parceiroPortalNome = (parceiroPortalRaw as { full_name?: string } | null)?.full_name ?? null

  const partes = (processo.partes_raw as { polo: string; nome: string }[] | null) ?? []

  // Email do advogado responsável (para pré-selecionar no agendamento)
  const advogadoId  = advogadoIdProcesso
  const advogadoEmail = advogadoId ? emailMap.get(advogadoId) ?? null : null

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
  type MovRow = { id: string; descricao: string; complemento: string | null; data_movimentacao: string; codigo_movimento: number | null }
  const movimentacoesTyped = (movimentacoes ?? []) as MovRow[]
  const audiencias = movimentacoesTyped.filter((m) => isAudiencia(m.descricao))

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
  const gruposMov: { mes: string; itens: MovRow[] }[] = []
  for (const m of movimentacoesTyped) {
    const [ano, mes] = m.data_movimentacao.slice(0, 10).split('-')
    const rotulo = `${MESES[Number(mes) - 1] ?? mes} de ${ano}`
    const ultimo = gruposMov[gruposMov.length - 1]
    if (ultimo && ultimo.mes === rotulo) ultimo.itens.push(m)
    else gruposMov.push({ mes: rotulo, itens: [m] })
  }

  // Dados prontos para o acordeão (formata data + flag de audiência aqui no server)
  // Alguns tribunais publicam movimentações com dataHora no futuro (ex.: código
  // 92 "Publicação" pode trazer a data em que o edital será publicado no diário
  // oficial, não a data do registro em si) — é dado real do DataJud, não bug de
  // parsing nosso. Sem um sinal visual, isso parece um erro no sistema (o mês
  // aparece no topo do histórico, acima de "hoje"). Marca como `futura` pra a
  // timeline explicar em vez de esconder ou reordenar o dado.
  const hojeStr = (() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
  })()

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
      futura: m.data_movimentacao.slice(0, 10) > hojeStr,
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
        {!isParceiro && (
          <div className="flex items-center gap-2">
            <SolicitarGuiaDialog processoId={id} numeroProcesso={processo.numero_processo} />
            <Link
              href={`/processos/${id}/editar`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Pencil className="size-3.5" />
              Editar
            </Link>
          </div>
        )}
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
          {isParceiro ? (
            <span className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground">
              {STATUS_LABEL[processo.status] ?? processo.status}
            </span>
          ) : (
            <ProcessoAcoes
              processoId={id}
              statusAtual={processo.status}
              podeExcluir={podeExcluir}
            />
          )}
        </div>

        {/* Faixa de resumo (KPIs) — honorário e contagem de movimentações são
            dados internos/de tabela-filha fechada pra parceiro (RLS); omitidos. */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {!isParceiro && <Kpi label="Honorário" value={honorarioFmt} sub={honorarioSub} accent />}
          <Kpi label="Valor da causa" value={valorCausaFmt} />
          <Kpi label="Área" value={areaLabel} />
          {!isParceiro && <Kpi label="Movimentações" value={String(movCount)} />}
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
          {clienteNome && clienteId && !isParceiro ? (
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
          {!isParceiro && !!(processo as Record<string, unknown>).indicacao && (
            <InfoItem icon={Users} label="Indicação" value={String((processo as Record<string, unknown>).indicacao)} />
          )}
          {!isParceiro && parceiroPortalNome && (
            <InfoItem icon={Handshake} label="Parceiro" value={parceiroPortalNome} />
          )}
          {!isParceiro && !!(processo as Record<string, unknown>).polo_passivo_nome && (
            <InfoItem icon={Users} label="Polo passivo" value={String((processo as Record<string, unknown>).polo_passivo_nome)} />
          )}
          {!isParceiro && !!(processo as Record<string, unknown>).advogado_adversario_nome && (
            <InfoItem
              icon={User}
              label="Adv. adversário"
              value={`${String((processo as Record<string, unknown>).advogado_adversario_nome)}${(processo as Record<string, unknown>).advogado_adversario_oab ? ` (OAB: ${String((processo as Record<string, unknown>).advogado_adversario_oab)})` : ''}`}
            />
          )}
        </div>

        {/* Dados do escritório (importados da planilha) — nunca pra parceiro */}
        {!isParceiro && (!!(processo as Record<string, unknown>).providencia || !!(processo as Record<string, unknown>).status_interno) && (
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

        {/* Indicação → Parceiro (indicador comercial) — só pra time interno */}
        {!isParceiro && indicacao && (
          <IndicacaoParceiroPrompt
            indicacao={indicacao}
            clienteId={clienteId}
            parceiroId={parceiroVinculado?.id ?? null}
            parceiroNome={parceiroVinculado?.nome ?? null}
          />
        )}

        {/* Partes — nunca pra parceiro */}
        {!isParceiro && partes.length > 0 && (
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

      {/* Próximas Audiências — vêm de movimentacoes_processo, tabela-filha
          fechada pra parceiro (RLS); a lista já chega vazia pra ele. */}
      {!isParceiro && audiencias.length > 0 && (
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

      {/* Abas: Movimentações | Histórico Interno | Prazos | Documentos — todas
          apoiadas em tabelas-filhas que a RLS fecha pra parceiro. Nem renderiza. */}
      {isParceiro ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Portal do parceiro: você vê os dados básicos deste processo. Documentos, prazos,
          honorários e andamentos internos são de uso exclusivo do escritório.
        </div>
      ) : (
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
      )}
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
