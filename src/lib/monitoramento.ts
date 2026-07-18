import type { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { ultimaExecucaoCron, type CronSlug } from '@/lib/cron-execucoes'
import { inicioDaJanelaEsperada, DIAS_ATIVOS } from '@/app/api/cron/watchdog-sincronizacao/route'

/**
 * true quando HOJE (UTC) não é um dos dias em que os crons de sincronização
 * jurídica (atualizar-processos/DataJud, publicacoes-djen/DJEN) sequer
 * deveriam rodar (vercel.json: a cada 15min, 3h-10h UTC, domingo-quinta).
 * Nesses dias, ficar parado é o estado NORMAL por design, não uma falha — os
 * sensores que dependem dessa escala usam isto pra reportar 'ok' em vez de
 * 'alerta', e assim não disparam e-mail de alarme por 2 dias seguidos à toa.
 */
function foraDaJanelaAtiva(agora: Date): boolean {
  return !DIAS_ATIVOS.has(agora.getUTCDay())
}

/**
 * Centro de Monitoramento CRM Studio — lib de sensores.
 * Spec: .claude/specs/monitor-ejlabs-sensores-cron.md
 *
 * Tipo compartilhado com o painel admin e o endpoint de leitura do widget do
 * Mac (outros streams) — eles só LEEM `monitoramento_status`, quem recomputa
 * é sempre o cron (/api/cron/monitor-ejlabs) chamando `computarSensores`.
 */
export type SensorComputado = {
  chave: string
  nome: string
  area: string
  status: 'ok' | 'alerta' | 'critico'
  detalhe: string
}

type AdminClient = ReturnType<typeof createAdminClient>

const AREA_LEILA = 'Leila / WhatsApp'
const AREA_ATENDIMENTO = 'Atendimento'
const AREA_CONTRATOS = 'Contratos'
const AREA_FINANCEIRO = 'Financeiro'
const AREA_INFRA = 'Infraestrutura'

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function isoHorasAtras(horas: number): string {
  return new Date(Date.now() - horas * 60 * 60 * 1000).toISOString()
}

/**
 * Roda um sensor "de resultado único" com isolamento de falha: se `fn` lançar
 * (erro de banco, bug, o que for), o sensor quebrado vira `critico` em vez de
 * derrubar `computarSensores` inteiro ou os sensores irmãos (Promise.all).
 */
async function comFallback(
  chave: string,
  nome: string,
  area: string,
  fn: () => Promise<SensorComputado>,
): Promise<SensorComputado> {
  try {
    return await fn()
  } catch (e) {
    return { chave, nome, area, status: 'critico', detalhe: `sensor falhou ao computar: ${msg(e)}` }
  }
}

/** Mesma ideia de `comFallback`, para sensores que produzem vários resultados de uma vez. */
async function comFallbackMulti(
  fallbacks: Array<{ chave: string; nome: string; area: string }>,
  fn: () => Promise<SensorComputado[]>,
): Promise<SensorComputado[]> {
  try {
    return await fn()
  } catch (e) {
    const detalhe = `sensor falhou ao computar: ${msg(e)}`
    return fallbacks.map((f) => ({ ...f, status: 'critico' as const, detalhe }))
  }
}

// ── 3.1 leila-buraco-negro ────────────────────────────────────────────────

async function sensorLeilaBuracoNegro(db: AdminClient): Promise<SensorComputado> {
  const chave = 'leila-buraco-negro'
  const nome = 'Leila — mensagens de lead sem resposta'
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { count, error } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'in')
    .eq('author_type', 'lead')
    .not('texto', 'is', null)
    .eq('respondida', false)
    .lt('created_at', cutoff)
  if (error) throw error

  const n = count ?? 0
  return {
    chave,
    nome,
    area: AREA_LEILA,
    status: n === 0 ? 'ok' : 'critico',
    detalhe:
      n === 0
        ? 'nenhuma mensagem de lead sem resposta há mais de 10min'
        : `${n} mensagem(ns) de lead sem resposta da Leila há mais de 10min — ver messages.respondida=false`,
  }
}

// ── 3.2 leila-modo-mock, leila-gemini, leila-whatsapp-token ────────────────

type SaudeAppSdr = {
  mock?: boolean
  gemini_ok?: boolean
  gemini_erro?: string
  whatsapp_token_valido?: boolean | null
}

async function sensoresLeilaSaude(): Promise<SensorComputado[]> {
  const url = process.env.SDR_CHAT_API_URL
  const token = process.env.MONITOR_INTERNO_TOKEN

  const critico3 = (detalhe: string): SensorComputado[] => [
    { chave: 'leila-modo-mock', nome: 'Leila — modo mock', area: AREA_LEILA, status: 'critico', detalhe },
    { chave: 'leila-gemini', nome: 'Leila — Gemini', area: AREA_LEILA, status: 'critico', detalhe },
    { chave: 'leila-whatsapp-token', nome: 'Leila — token do WhatsApp', area: AREA_LEILA, status: 'critico', detalhe },
  ]

  if (!url || !token) {
    return critico3(
      'não foi possível checar a saúde interna do app-sdr: SDR_CHAT_API_URL ou MONITOR_INTERNO_TOKEN não configurados',
    )
  }

  let body: SaudeAppSdr
  try {
    const res = await fetch(`${url}/api/monitor/interno`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    body = (await res.json()) as SaudeAppSdr
  } catch (e) {
    return critico3(`não foi possível checar a saúde interna do app-sdr: ${msg(e)}`)
  }

  const mock = body.mock === true
  const tokenInvalido = body.whatsapp_token_valido === false && !mock

  return [
    {
      chave: 'leila-modo-mock',
      nome: 'Leila — modo mock',
      area: AREA_LEILA,
      status: mock ? 'critico' : 'ok',
      detalhe: mock
        ? 'app-sdr está em modo mock — o sistema pode estar mandando mensagens fake em produção sem avisar ninguém'
        : 'modo mock desligado',
    },
    {
      chave: 'leila-gemini',
      nome: 'Leila — Gemini',
      area: AREA_LEILA,
      status: body.gemini_ok === false ? 'critico' : 'ok',
      detalhe:
        body.gemini_ok === false
          ? `Gemini com falha: ${body.gemini_erro ?? 'erro não especificado pelo app-sdr'}`
          : 'Gemini respondendo normalmente',
    },
    {
      chave: 'leila-whatsapp-token',
      nome: 'Leila — token do WhatsApp',
      area: AREA_LEILA,
      status: tokenInvalido ? 'alerta' : 'ok',
      detalhe: tokenInvalido
        ? 'token da WhatsApp Cloud API inválido/expirado'
        : 'token do WhatsApp válido (ou não aplicável — app-sdr em modo mock)',
    },
  ]
}

// ── 3.3 leila-handoff ───────────────────────────────────────────────────

async function sensorLeilaHandoff(db: AdminClient): Promise<SensorComputado> {
  const chave = 'leila-handoff'
  const nome = 'Leila — handoff pro pipeline'
  const cutoff = isoHorasAtras(24)

  // Antes: comparava contagem de conversas encaminhadas vs negócios NOVOS
  // criados — dava falso positivo sempre que o handoff funcionava mas
  // REUTILIZAVA um negócio já aberto do mesmo cliente (comportamento correto
  // e comum do /api/leads/ingest, não é falha). Agora: app-sdr registra a
  // falha de verdade em monitoramento_falhas_email (tipo='handoff_leila')
  // quando o POST pro CRM lança — sinal preciso, sem ambiguidade de reuso.
  const { data: falhas, error } = await db
    .from('monitoramento_falhas_email')
    .select('id, destinatario, erro, criado_em')
    .eq('tipo', 'handoff_leila')
    .gt('criado_em', cutoff)
    .order('criado_em', { ascending: false })
  if (error) throw error

  const n = falhas?.length ?? 0
  if (n === 0) {
    return { chave, nome, area: AREA_LEILA, status: 'ok', detalhe: 'nenhuma falha de handoff registrada nas últimas 24h' }
  }
  const exemplo = falhas![0]
  return {
    chave,
    nome,
    area: AREA_LEILA,
    status: 'critico',
    detalhe: `${n} falha(s) de handoff pro CRM nas últimas 24h — última: ${exemplo.destinatario} (${exemplo.erro})`,
  }
}

// ── 3.4 atendimento-entrega-falha ───────────────────────────────────────

async function sensorAtendimentoEntregaFalha(db: AdminClient): Promise<SensorComputado> {
  const chave = 'atendimento-entrega-falha'
  const nome = 'Atendimento — falhas de entrega de mensagem'
  const cutoff = isoHorasAtras(6)

  const { count, error } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('delivery_status', 'failed')
    .gt('created_at', cutoff)
  if (error) throw error

  const n = count ?? 0
  const status = n === 0 ? 'ok' : n <= 4 ? 'alerta' : 'critico'
  return {
    chave,
    nome,
    area: AREA_ATENDIMENTO,
    status,
    detalhe: `${n} mensagem(ns) com falha de entrega nas últimas 6h`,
  }
}

// ── 3.5 contratos-parado ────────────────────────────────────────────────
// ponytail: a spec pede `updated_at`, mas contratos_gerados nunca ganhou essa
// coluna (ver migrations 20260629190000_contratos_whitelabel.sql +
// 20260713120000_contratos_assinatura_zapsign.sql — só existe created_at) —
// usando created_at como a própria spec já previa para este caso.

async function sensorContratosParado(db: AdminClient): Promise<SensorComputado> {
  const chave = 'contratos-parado'
  const nome = 'Contratos parados aguardando assinatura'
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await db
    .from('contratos_gerados')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'enviado')
    .lt('created_at', cutoff)
  if (error) throw error

  const n = count ?? 0
  return {
    chave,
    nome,
    area: AREA_CONTRATOS,
    status: n === 0 ? 'ok' : 'alerta',
    detalhe:
      n === 0
        ? 'nenhum contrato parado em "enviado" há mais de 5 dias'
        : `${n} contrato(s) parado(s) em "enviado" há mais de 5 dias sem resposta do ZapSign`,
  }
}

// ── 3.6 contratos-orfao ─────────────────────────────────────────────────
// ponytail: mesmo caso de 3.5 — sem updated_at em contratos_gerados, usa created_at.

async function sensorContratosOrfao(db: AdminClient): Promise<SensorComputado> {
  const chave = 'contratos-orfao'
  const nome = 'Contratos assinados sem PDF final'
  const cutoff = isoHorasAtras(6)

  const { count, error } = await db
    .from('contratos_gerados')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'assinado')
    .is('signed_storage_path', null)
    .lt('created_at', cutoff)
  if (error) throw error

  const n = count ?? 0
  return {
    chave,
    nome,
    area: AREA_CONTRATOS,
    status: n === 0 ? 'ok' : 'critico',
    detalhe:
      n === 0
        ? 'nenhum contrato "assinado" sem PDF final'
        : `${n} contrato(s) "assinado(s)" sem signed_storage_path há mais de 6h — dado potencialmente perdido`,
  }
}

// ── 3.7 asaas-eventos-falhos ────────────────────────────────────────────

async function sensorAsaasEventosFalhos(db: AdminClient): Promise<SensorComputado> {
  const chave = 'asaas-eventos-falhos'
  const nome = 'Asaas — eventos de webhook com falha'
  const cutoff = isoHorasAtras(48)

  const { count, error } = await db
    .from('eventos_webhook')
    .select('id', { count: 'exact', head: true })
    .or('error.not.is.null,processed.eq.false')
    .gt('received_at', cutoff)
  if (error) throw error

  const n = count ?? 0
  return {
    chave,
    nome,
    area: AREA_FINANCEIRO,
    status: n === 0 ? 'ok' : 'critico',
    detalhe:
      n === 0
        ? 'nenhum evento de webhook do Asaas com falha nas últimas 48h'
        : `${n} evento(s) de webhook do Asaas com falha/não processado(s) nas últimas 48h`,
  }
}

// ── 3.8 asaas-silencio ──────────────────────────────────────────────────
// ponytail: a spec pede `empresas.updated_at`, mas a tabela nunca ganhou essa
// coluna (ver migration 20260611180000_multitenant_foundation.sql — só tem
// created_at) — usando created_at como proxy, mesmo fallback já aplicado em
// contratos-parado/contratos-orfao (3.5/3.6).

async function sensorAsaasSilencio(db: AdminClient): Promise<SensorComputado> {
  const chave = 'asaas-silencio'
  const nome = 'Asaas — silêncio prolongado do webhook'
  const cutoffEmpresa = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const cutoffWebhook = isoHorasAtras(48)

  const { count: empresasParadas, error: errEmp } = await db
    .from('empresas')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pendente', 'pendente_cartao', 'atrasado'])
    .lt('created_at', cutoffEmpresa)
  if (errEmp) throw errEmp

  const nEmpresas = empresasParadas ?? 0
  if (nEmpresas === 0) {
    return { chave, nome, area: AREA_FINANCEIRO, status: 'ok', detalhe: 'nenhuma empresa parada em status pendente de pagamento' }
  }

  const { count: eventosRecentes, error: errEv } = await db
    .from('eventos_webhook')
    .select('id', { count: 'exact', head: true })
    .gt('received_at', cutoffWebhook)
  if (errEv) throw errEv

  const webhookVivo = (eventosRecentes ?? 0) > 0
  if (webhookVivo) {
    return {
      chave,
      nome,
      area: AREA_FINANCEIRO,
      status: 'ok',
      detalhe: `${nEmpresas} empresa(s) parada(s), mas o webhook do Asaas está vivo (ver asaas-eventos-falhos)`,
    }
  }
  return {
    chave,
    nome,
    area: AREA_FINANCEIRO,
    status: 'alerta',
    detalhe: `${nEmpresas} empresa(s) parada(s) em status pendente de pagamento e nenhum evento de webhook do Asaas nas últimas 48h — possível silêncio prolongado`,
  }
}

// ── 3.9 emails-falhos ───────────────────────────────────────────────────

async function sensorEmailsFalhos(db: AdminClient): Promise<SensorComputado> {
  const chave = 'emails-falhos'
  const nome = 'E-mails com falha de envio'
  const cutoff = isoHorasAtras(24)

  const { count, error } = await db
    .from('monitoramento_falhas_email')
    .select('id', { count: 'exact', head: true })
    .gt('criado_em', cutoff)
  if (error) throw error

  const n = count ?? 0
  const status = n === 0 ? 'ok' : n <= 2 ? 'alerta' : 'critico'
  return {
    chave,
    nome,
    area: AREA_FINANCEIRO,
    status,
    detalhe: `${n} falha(s) de envio de e-mail registrada(s) nas últimas 24h`,
  }
}

// ── 3.10 cron-saude (um sensor por cron) ────────────────────────────────

type ConfigCronSaude = {
  chave: string
  nome: string
  slug: CronSlug
  janelaEsperada: (agora: Date) => Date
  /** true = este cron só roda domingo-quinta; em sex/sáb, ausência de execução é normal. */
  somenteDiasAtivos?: boolean
}

const CONFIGS_CRON_SAUDE: ConfigCronSaude[] = [
  {
    chave: 'cron-atualizar-processos',
    nome: 'Cron — atualizar-processos (DataJud)',
    slug: 'atualizar-processos',
    janelaEsperada: inicioDaJanelaEsperada,
    somenteDiasAtivos: true,
  },
  {
    chave: 'cron-publicacoes-djen',
    nome: 'Cron — publicacoes-djen (DJEN)',
    slug: 'publicacoes-djen',
    janelaEsperada: inicioDaJanelaEsperada,
    somenteDiasAtivos: true,
  },
  {
    chave: 'cron-purgar-canceladas',
    nome: 'Cron — purgar-canceladas',
    slug: 'purgar-canceladas',
    janelaEsperada: (agora) => new Date(agora.getTime() - 30 * 60 * 60 * 1000),
  },
  {
    chave: 'cron-sync-google-calendar',
    nome: 'Cron — sync-google-calendar',
    slug: 'sync-google-calendar',
    janelaEsperada: (agora) => new Date(agora.getTime() - 40 * 60 * 1000),
  },
  {
    chave: 'cron-watchdog-sincronizacao',
    nome: 'Cron — watchdog-sincronizacao',
    slug: 'watchdog-sincronizacao',
    janelaEsperada: (agora) => new Date(agora.getTime() - 30 * 60 * 60 * 1000),
  },
]

async function sensorCronSaude(db: AdminClient, cfg: ConfigCronSaude): Promise<SensorComputado> {
  // Dia em que este cron nem deveria rodar (sex/sáb pros de sincronização jurídica) —
  // ficar em silêncio é o estado NORMAL, não alarme. Curto-circuita ANTES de olhar
  // pra cron_execucoes: mesmo "nunca registrou execução" não é alerta aqui.
  if (cfg.somenteDiasAtivos && foraDaJanelaAtiva(new Date())) {
    return {
      chave: cfg.chave,
      nome: cfg.nome,
      area: AREA_INFRA,
      status: 'ok',
      detalhe: 'dormente por escala (só roda dom-qui) — normal em sex/sáb, retoma domingo ~3h UTC',
    }
  }

  const ultima = await ultimaExecucaoCron(db, cfg.slug)

  // "!ok" é sempre crítico, mesmo que a execução tenha sido recente (regra explícita
  // da spec) — sobrepõe o alerta de janela abaixo.
  if (ultima && !ultima.ok) {
    return {
      chave: cfg.chave,
      nome: cfg.nome,
      area: AREA_INFRA,
      status: 'critico',
      detalhe: `última execução (${ultima.executado_em}) terminou com falha — ${JSON.stringify(ultima.resumo)}`,
    }
  }

  const cutoff = cfg.janelaEsperada(new Date())
  if (!ultima || new Date(ultima.executado_em) < cutoff) {
    return {
      chave: cfg.chave,
      nome: cfg.nome,
      area: AREA_INFRA,
      status: 'alerta',
      detalhe: ultima
        ? `última execução em ${ultima.executado_em}, antes da janela esperada (${cutoff.toISOString()})`
        : `${cfg.slug} nunca registrou execução em cron_execucoes`,
    }
  }

  return {
    chave: cfg.chave,
    nome: cfg.nome,
    area: AREA_INFRA,
    status: 'ok',
    detalhe: `última execução ok em ${ultima.executado_em}`,
  }
}

async function sensoresCronSaude(db: AdminClient): Promise<SensorComputado[]> {
  return Promise.all(CONFIGS_CRON_SAUDE.map((cfg) => sensorCronSaude(db, cfg)))
}

// ── 3.11 datajud-fila-tribunal ──────────────────────────────────────────

async function sensorDatajudFilaTribunal(db: AdminClient): Promise<SensorComputado> {
  const chave = 'datajud-fila-tribunal'
  const nome = 'DataJud — fila de sincronização por tribunal'

  // Mesma regra do cron que alimenta esta fila (atualizar-processos, só dom-qui):
  // em sex/sáb a fila não avança por design — reportar isso como alerta só
  // confundiria com um problema real. Curto-circuita antes da query.
  if (foraDaJanelaAtiva(new Date())) {
    return {
      chave,
      nome,
      area: AREA_INFRA,
      status: 'ok',
      detalhe: 'dormente por escala (a sincronização só roda dom-qui) — normal em sex/sáb, retoma domingo ~3h UTC',
    }
  }

  // ponytail: sem RPC/view nova pra fazer o GROUP BY no banco (fora da lane —
  // só posso mexer nos arquivos listados na spec) — busca as linhas cruas com
  // fetchAllRows (contorna o cap de 1000 do PostgREST) e agrupa em JS. Volume
  // esperado é baixo (processos em_transito de um único escritório).
  const rows = await fetchAllRows<{ tribunal_slug: string; ultimo_datajud_update: string | null }>((from, to) =>
    db
      .from('processos_juridicos')
      .select('tribunal_slug, ultimo_datajud_update')
      .eq('status', 'em_transito')
      .range(from, to),
  )

  // Mais antigo por tribunal — min() ignorando NULLs, igual o min() do SQL
  // faria: uma única linha null não pode "contaminar" o agregado de um
  // tribunal que tem outras linhas saudáveis. Só conta como "nunca
  // sincronizado" quando TODAS as linhas daquele tribunal forem null.
  const minPorTribunal = new Map<string, string>()
  const todosOsTribunais = new Set<string>()
  for (const row of rows) {
    todosOsTribunais.add(row.tribunal_slug)
    if (row.ultimo_datajud_update === null) continue
    const atual = minPorTribunal.get(row.tribunal_slug)
    if (!atual || row.ultimo_datajud_update < atual) {
      minPorTribunal.set(row.tribunal_slug, row.ultimo_datajud_update)
    }
  }

  const TRES_HORAS_MS = 3 * 60 * 60 * 1000
  const travados: string[] = []
  for (const slug of todosOsTribunais) {
    const ts = minPorTribunal.get(slug) ?? null
    if (ts === null) {
      travados.push(`${slug}: nunca sincronizado`)
      continue
    }
    const idade = Date.now() - new Date(ts).getTime()
    if (idade > TRES_HORAS_MS) {
      travados.push(`${slug}: sem avançar há ${Math.floor(idade / (60 * 60 * 1000))}h`)
    }
  }

  return {
    chave,
    nome,
    area: AREA_INFRA,
    status: travados.length === 0 ? 'ok' : 'alerta',
    detalhe: travados.length === 0 ? 'nenhum tribunal travado há mais de 3h' : travados.join('; '),
  }
}

// ── 3.12 cron-externo (healthchecks.io) ──────────────────────────────────
// Vigia de FORA do sistema: prova que a Vercel disparou o cron, mesmo se o
// app inteiro estivesse fora do ar — cenário que os sensores acima (rodam
// dentro do próprio app, via monitor-ejlabs) não conseguem detectar. Achado
// de auditoria 2026-07-18: nenhum dos 6 crons tinha o vigia externo
// realmente configurado na Vercel até então (código chamava pingHealthcheck,
// mas a env var nunca existiu).

type CheckExterno = {
  chave: string
  nome: string
  /** substring que identifica este cron no NOME do check no healthchecks.io */
  matchName: string
}

const CHECKS_EXTERNOS_ESPERADOS: CheckExterno[] = [
  { chave: 'hc-atualizar-processos', nome: 'Vigia externo — atualizar-processos', matchName: 'atualizar-processos' },
  { chave: 'hc-publicacoes-djen', nome: 'Vigia externo — publicacoes-djen', matchName: 'publicacoes-djen' },
  { chave: 'hc-purgar-canceladas', nome: 'Vigia externo — purgar-canceladas', matchName: 'purgar-canceladas' },
  { chave: 'hc-sync-google-calendar', nome: 'Vigia externo — sync-google-calendar', matchName: 'sync-google-calendar' },
  { chave: 'hc-watchdog-sincronizacao', nome: 'Vigia externo — watchdog-sincronizacao', matchName: 'watchdog-sincronizacao' },
  {
    chave: 'hc-monitor-ejlabs',
    nome: 'Vigia externo — Centro de Monitoramento (o próprio vigia)',
    matchName: 'monitor-ejlabs',
  },
]

type HealthchecksStatus = 'up' | 'down' | 'grace' | 'paused' | 'new'

function statusExternoParaSensor(status: HealthchecksStatus | undefined): 'ok' | 'alerta' | 'critico' {
  switch (status) {
    case 'up':
    case 'new':
      // 'new' NÃO é falha — o healthchecks.io calcula a próxima ocorrência
      // esperada a partir de QUANDO o check foi criado (modo schedule/cron),
      // não do passado. Um check recém-criado cujo primeiro horário esperado
      // ainda não chegou (ex.: cron diário criado à tarde, próxima vez só
      // amanhã) fica 'new' legitimamente — só vira 'down' se de fato perder
      // um horário que já deveria ter acontecido depois da criação. Tratar
      // 'new' como alerta duplicava (e badamente, sem saber o schedule) a
      // regra de "dia/horário ainda não chegou" que o cronSaude interno já
      // resolve corretamente via foraDaJanelaAtiva — reaproveitar o cálculo
      // do próprio healthchecks.io em vez de reimplementar.
      return 'ok'
    case 'down':
      return 'critico'
    case 'grace':
    case 'paused':
    default:
      // 'grace' = já deveria ter pingado e está na tolerância antes de virar
      // 'down'; 'paused' = alguém desligou o vigia manualmente — os dois
      // merecem atenção.
      return 'alerta'
  }
}

async function sensoresCronExterno(): Promise<SensorComputado[]> {
  const apiKey = process.env.HEALTHCHECKS_API_KEY

  const fallback = (detalhe: string): SensorComputado[] =>
    CHECKS_EXTERNOS_ESPERADOS.map((c) => ({
      chave: c.chave,
      nome: c.nome,
      area: AREA_INFRA,
      status: 'alerta' as const,
      detalhe,
    }))

  if (!apiKey) {
    return fallback('HEALTHCHECKS_API_KEY não configurada — vigia externo desligado')
  }

  type ChecksResponse = { checks: Array<{ name: string; status: HealthchecksStatus; last_ping: string | null }> }
  let checks: ChecksResponse['checks']
  try {
    const res = await fetch('https://healthchecks.io/api/v3/checks/', {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as ChecksResponse
    checks = body.checks ?? []
  } catch (e) {
    return fallback(`falha ao consultar a API do healthchecks.io: ${msg(e)}`)
  }

  return CHECKS_EXTERNOS_ESPERADOS.map((cfg) => {
    const check = checks.find((c) => c.name.toLowerCase().includes(cfg.matchName.toLowerCase()))
    if (!check) {
      return {
        chave: cfg.chave,
        nome: cfg.nome,
        area: AREA_INFRA,
        status: 'alerta' as const,
        detalhe: 'nenhum check encontrado no healthchecks.io com esse nome — ainda não foi criado?',
      }
    }
    return {
      chave: cfg.chave,
      nome: cfg.nome,
      area: AREA_INFRA,
      status: statusExternoParaSensor(check.status),
      detalhe: `status no healthchecks.io: ${check.status}${check.last_ping ? ` · último ping: ${check.last_ping}` : ' · nunca pingou'}`,
    }
  })
}

// ── Entry point ──────────────────────────────────────────────────────────

export async function computarSensores(db: AdminClient): Promise<SensorComputado[]> {
  const [
    leilaBuracoNegro,
    leilaSaude,
    leilaHandoff,
    atendimentoEntregaFalha,
    contratosParado,
    contratosOrfao,
    asaasEventosFalhos,
    asaasSilencio,
    emailsFalhos,
    cronSaude,
    datajudFilaTribunal,
    cronExterno,
  ] = await Promise.all([
    comFallback('leila-buraco-negro', 'Leila — mensagens de lead sem resposta', AREA_LEILA, () =>
      sensorLeilaBuracoNegro(db),
    ),
    comFallbackMulti(
      [
        { chave: 'leila-modo-mock', nome: 'Leila — modo mock', area: AREA_LEILA },
        { chave: 'leila-gemini', nome: 'Leila — Gemini', area: AREA_LEILA },
        { chave: 'leila-whatsapp-token', nome: 'Leila — token do WhatsApp', area: AREA_LEILA },
      ],
      () => sensoresLeilaSaude(),
    ),
    comFallback('leila-handoff', 'Leila — handoff pro pipeline', AREA_LEILA, () => sensorLeilaHandoff(db)),
    comFallback('atendimento-entrega-falha', 'Atendimento — falhas de entrega de mensagem', AREA_ATENDIMENTO, () =>
      sensorAtendimentoEntregaFalha(db),
    ),
    comFallback('contratos-parado', 'Contratos parados aguardando assinatura', AREA_CONTRATOS, () =>
      sensorContratosParado(db),
    ),
    comFallback('contratos-orfao', 'Contratos assinados sem PDF final', AREA_CONTRATOS, () =>
      sensorContratosOrfao(db),
    ),
    comFallback('asaas-eventos-falhos', 'Asaas — eventos de webhook com falha', AREA_FINANCEIRO, () =>
      sensorAsaasEventosFalhos(db),
    ),
    comFallback('asaas-silencio', 'Asaas — silêncio prolongado do webhook', AREA_FINANCEIRO, () =>
      sensorAsaasSilencio(db),
    ),
    comFallback('emails-falhos', 'E-mails com falha de envio', AREA_FINANCEIRO, () => sensorEmailsFalhos(db)),
    comFallbackMulti(
      CONFIGS_CRON_SAUDE.map((c) => ({ chave: c.chave, nome: c.nome, area: AREA_INFRA })),
      () => sensoresCronSaude(db),
    ),
    comFallback('datajud-fila-tribunal', 'DataJud — fila de sincronização por tribunal', AREA_INFRA, () =>
      sensorDatajudFilaTribunal(db),
    ),
    comFallbackMulti(
      CHECKS_EXTERNOS_ESPERADOS.map((c) => ({ chave: c.chave, nome: c.nome, area: AREA_INFRA })),
      () => sensoresCronExterno(),
    ),
  ])

  return [
    leilaBuracoNegro,
    ...leilaSaude,
    leilaHandoff,
    atendimentoEntregaFalha,
    contratosParado,
    contratosOrfao,
    asaasEventosFalhos,
    asaasSilencio,
    emailsFalhos,
    ...cronSaude,
    datajudFilaTribunal,
    ...cronExterno,
  ]
}
